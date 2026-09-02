import { Injectable } from '@nestjs/common';


import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { config } from '../config.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class RagService {


    private llm = new ChatOllama({
        model: config.ollama.chatModel,
        temperature: config.ollama.temperature,
        baseUrl: config.ollama.baseUrl,
        think: false,
        numPredict: 100
    })

    // 向量化模型：把文本转成数字向量（用于相似度比较）
    private embeddings = new OllamaEmbeddings({
        model: config.ollama.embeddingModel,   // 'mxbai-embed-large'
        baseUrl: config.ollama.baseUrl,
    })

    // 内存向量库（null 表示未初始化）
    private vectorStore: MemoryVectorStore | null = null
    private docCount = 0

    async loadDocuments(documents: { id: string; content: string; source: string }[]) {
        // 文本分块器
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 50,
            separators: ['\n\n', '\n', '。', '！', '？', ' ', ''],
        })

        const allDocuments: Document[] = []
        for (const doc of documents) {
            const chunks = await splitter.createDocuments([doc.content], [{ source: doc.source, id: doc.id }])
            allDocuments.push(...chunks)
        }

        // 运行时是位置参数 (docs, embeddings)，但类型定义写成了对象参数，用 as any 绕过
        this.vectorStore = await (MemoryVectorStore.fromDocuments as any)(
            allDocuments,
            this.embeddings
        )
        this.docCount = allDocuments.length
        return {
            success: true,
            originalDocs: documents.length,
            totalChunks: allDocuments.length,
            message: `加载 ${documents.length} 篇文档，共 ${allDocuments.length} 个块`
        }
    }

    getStatus() {
        return {
            loaded: !!this.vectorStore,
            docCount: this.docCount,
            message: this.vectorStore
                ? `已加载 ${this.docCount} 篇文档`
                : '知识库为空，请先加载文档',
        }
    }

    async search(query: string, topK: number) {
        if (!this.vectorStore) {
            return {
                error: '知识库未加载，请先加载文档'
            }
        }
        const results = await this.vectorStore.similaritySearchWithScore(query, topK)
        return {
            query,
            results: results.map(([doc, score]) => ({
                content: doc.pageContent,
                source: doc.metadata.source,
                score,
            }))
        }
    }

    // ── 完整 RAG 问答 ─────────────────────────────────────
    async query(question: string, topK = 3) {
        if (!this.vectorStore) return { error: '请先调用 /rag/load 加载文档' }
        // Step 1：检索相关文档块
        const retrieved = await this.vectorStore.similaritySearchWithScore(
            question, topK,
        )

        if (!retrieved.length) {
            return { question, answer: '知识库中没有找到相关内容', sources: [] }
        }

        // Step 2：把检索结果拼成 context 字符串
        // [1] 第一块内容\n\n[2] 第二块内容...
        // 编号方便模型在回答时引用："根据[1]..."
        const context = retrieved
            .map(([doc], i) => `[${i + 1}] ${doc.pageContent}`)
            .join('\n\n')

        // Step 3：RAG Prompt，严格限制模型只能用参考资料回答
        const prompt = ChatPromptTemplate.fromMessages([
            [
                'system',
                `你是知识库问答助手，严格基于参考资料回答。
规则：
1. 只根据参考资料内容回答，不能使用资料外的知识
2. 资料中没有相关信息，回答"知识库中暂无相关内容"
3. 回答简洁准确，使用中文

参考资料：
{context}`,
            ],
            ['human', '{question}'],
        ])

        // Step 4：调用模型生成回答
        const chain = prompt.pipe(this.llm).pipe(new StringOutputParser())
        const answer = await chain.invoke({ context, question })
        return {
            question,
            answer,
            sources: retrieved.map(([doc, score]) => ({
                content: doc.pageContent,
                source: doc.metadata.source,
                score: parseFloat(score.toFixed(4)),
            })),
        }
    }

    clear() {
        this.vectorStore = null
        this.docCount = 0
        return { success: true, message: '知识库已清空' }
    }
}
