import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { config } from '../config.js';
import type { Response } from 'express';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class ModlesService {
    

    async chatSystem(system: string, message: string) {
        console.log(system, message);
        const response = await this.llm.invoke(
            [new SystemMessage({ content: system }), new HumanMessage({ content: message })]
        );
        return {
            system,
            question: message,
            answer: response.content,
            usage: response.usage_metadata
        }
    }

    private llm = new ChatOllama({
        model: config.ollama.chatModel,
        temperature: config.ollama.temperature,
        baseUrl: config.ollama.baseUrl,
        think: false,
        numPredict: 100
    })

    async baseChat(message: string) {
        const response = await this.llm.invoke(
            [new HumanMessage({ content: message })]
        );

        console.log(response);
        return {
            question: message,
            answer: response.content,
            usage: response.usage_metadata
        }
    }

    async chatStream(message: string, res: Response) {
        // 告诉浏览器，这是一个流式响应
        res.setHeader('Content-Type', 'text/event-stream');
        // 开启流式响应
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        // 开启流式响应
        const stream = await this.llm.stream(
            [new HumanMessage({ content: message })]
        );
        for await (const chunk of stream) {
            console.log(chunk);
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        //res.write(`data:[DONE]\n\n`);
        res.end(); // 必须关闭，否则客户端无法断开连接
    }

    async chatParser(message: string) {
        const chain = this.llm.pipe(new StringOutputParser());
        const response = await chain.invoke(
            [new HumanMessage({ content: message })]
        );
        return {
            question: message,
            answer: response,
        }
    }
}
