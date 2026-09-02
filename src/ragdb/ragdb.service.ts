import { Injectable } from '@nestjs/common';


import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { config } from '../config.js';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PGVectorStore, DistanceStrategy } from '@langchain/community/vectorstores/pgvector'
import { Pool } from 'pg';

@Injectable()
export class RagdbService {

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

    // 数据库连接池
    private pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // 连接池配置（可选，生产环境建议显式配置）
        max: 10,              // 最大连接数，根据并发量调整
        idleTimeoutMillis: 30000,  // 空闲连接 30 秒后释放
        connectionTimeoutMillis: 5000 // 获取连接超时 5 秒
    })

    private pgVectorstoreconfig = {
        pool: this.pool,
        collectionName: 'rag-knowledge-base',
        collectionTableName: 'langchain_pg_collection',
        tableName: 'langchain_pg_embedding',
        columns: {
            idColumnName: 'id',
            vectorColumnName: 'embedding',
            contentColumnName: 'document',
            metadataColumnName: 'cmetadata',
        },
        distanceStrategy: 'cosine' as DistanceStrategy
    }


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

        await PGVectorStore.fromDocuments(
            allDocuments,
            this.embeddings,
            this.pgVectorstoreconfig,
        )
        return {
            success: true,
            originalDocs: documents.length,
            totalChunks: allDocuments.length,
            message: `加载 ${documents.length} 篇文档，共 ${allDocuments.length} 个块`
        }
    }

    async getStatus() {
        try {
            const result = await this.pool.query(
                `SELECT COUNT(*) FROM langchain_pg_embedding
         WHERE collection_id = (
           SELECT uuid FROM langchain_pg_collection WHERE name = $1
         )`,
                [this.pgVectorstoreconfig.collectionName],
            )
            const chunkCount = parseInt(result.rows[0].count)
            return {
                mode: 'PGVectorStore',
                loaded: chunkCount > 0,
                chunkCount,
                collection: this.pgVectorstoreconfig.collectionName,
                message: chunkCount > 0
                    ? `PostgreSQL 向量库中有 ${chunkCount} 个文档块`
                    : '向量库为空，请先加载文档',
            }
        } catch {
            return { mode: 'PGVectorStore', loaded: false, message: '向量表未初始化' }
        }
    }

    async search(query: string, topK: number) {
        console.log("search ", query)
        // initialize() 从 this.pool 借一个连接，查完自动归还
        // ✅ 不需要也不应该调用 end()
        const vectorStore = await PGVectorStore.initialize(
            this.embeddings,
            this.pgVectorstoreconfig,
        )
        const results = await vectorStore.similaritySearchWithScore(query, topK)
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
        const vectorStore = await PGVectorStore.initialize(
            this.embeddings,
            this.pgVectorstoreconfig,
        )
        // Step 1：检索相关文档块
        const retrieved = await vectorStore.similaritySearchWithScore(
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

    async clear() {
        await this.pool.query(
            `DELETE FROM langchain_pg_embedding
       WHERE collection_id = (
         SELECT uuid FROM langchain_pg_collection WHERE name = $1
       )`,
            [this.pgVectorstoreconfig.collectionName],
        )
        await this.pool.query(
            `DELETE FROM langchain_pg_collection WHERE name = $1`,
            [this.pgVectorstoreconfig.collectionName],
        )
        return { success: true, message: `已清空 collection：${this.pgVectorstoreconfig.collectionName}` }
    }
}
