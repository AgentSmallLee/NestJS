import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { config } from '../config.js';
import type { Response } from 'express';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, FewShotPromptTemplate, PromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class PromptsService {
    
    async summarize(text: string, maxWords: number) {
        const prompt = ChatPromptTemplate.fromTemplate(
            '请把{text}摘要成{maxWords}个单词',
        )
        const chain = prompt.pipe(this.llm)
            .pipe(new StringOutputParser())
        const response = await chain.invoke({ text, maxWords })
        return {
            origin: text,
            summarize: response
        }
    }

    private llm = new ChatOllama({
        model: config.ollama.chatModel,
        temperature: config.ollama.temperature,
        baseUrl: config.ollama.baseUrl,
        think: false,
        numPredict: 100
    })


    async translate(text: string, targetLanguage: string) {
        const prompt = ChatPromptTemplate.fromMessages([
            ['system', '你是一个专业的翻译，你的任务是将用户输入的中文翻译成英文'],
            ['human', "请将下面的内容翻译成{targetLanguage}:{text}"]
        ])
        const chain = prompt.pipe(this.llm)
            .pipe(new StringOutputParser())
        const response = await chain.invoke({ text, targetLanguage })
        return {
            origin: text,
            translate: response
        }
    }

    async classify(text: string) {
        const example = [
            { text: '今天天气很好，我们去公园玩吧', label: '积极' },
            { text: '这个老师讲课一般一般', label: '消极' },
            { text: '这个电影还行，有些地方不错', label: '中立' },
        ]
        const examplePrompt = PromptTemplate.fromTemplate(
            '输入{text},输出{label}',
        )
        const fewShotPrompt = new FewShotPromptTemplate({
            examplePrompt,
            examples: example,
            prefix: '请根据输入的文本进行情感分类，输出中立，消极或者积极',
            inputVariables: ['text'],
            suffix: '输入{text},输出',
        })
        const formatPrompt = await fewShotPrompt.format({ text })
        const response = await this.llm.invoke(formatPrompt)
        return {
            origin: text,
            classify: response.content
        }
    }

    async codeReview(code: string, language: string) {
       const prompt = ChatPromptTemplate.fromMessages([
            ['system', '你是一个专业的{language}代码审查员，你的任务是审查用户输入的代码,并输出审查结果'],
            ['human', "请审查以下的{language}代码，并指出错误和改进:\n{code}"]
        ])
        const chain = prompt.pipe(this.llm)
            .pipe(new StringOutputParser())
        const response = await chain.invoke({ code, language })
        return {
            origin: code,
            codeReview: response
        }
    }
}
