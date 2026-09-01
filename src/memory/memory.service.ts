import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Get, Injectable, Param } from '@nestjs/common';

import { ChatOllama } from '@langchain/ollama';
import { config } from '../config.js';
import type { Response } from 'express';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class MemoryService {





    private llm = new ChatOllama({
        model: config.ollama.chatModel,
        temperature: config.ollama.temperature,
        baseUrl: config.ollama.baseUrl,
        think: false,
        numPredict: 100
    })

    // 会话存储：sessionId → 消息历史数组
    // NestJS Service 是单例，Map 在整个应用生命周期内存在
    private sessions = new Map<string, BaseMessage[]>()

    private systemMessage = new SystemMessage(
        '你是一个智能助手，能记住对话历史，根据上下文准确回答。',
    )

    private getOrCreate(sessionId: string): BaseMessage[] {
        if (!this.sessions.has(sessionId)) {
            // 新会话：初始化时加入 SystemMessage
            this.sessions.set(sessionId, [this.systemMessage])
        }
        return this.sessions.get(sessionId)!
    }

    // ── 多轮对话（REST 版本）──────────────────────────────
    async chat(sessionId: string, message: string) {
        const history = this.getOrCreate(sessionId)

        // 把用户新消息加入历史
        history.push(new HumanMessage(message))

        // 把完整历史发给模型（包含 System + 所有历史 + 本次消息）
        // 模型看到完整上下文，能理解之前说了什么
        const response = await this.llm.invoke(history)
        // 把模型回复也加入历史，下次对话继续携带
        history.push(response)
        return {
            sessionId,
            message,
            reply: response.content,
            turns: Math.floor((history.length - 1) / 2), // 对话轮次
        }
    }

    history(sessionId: string) {
        const history = this.sessions.get(sessionId)
        if (!history) {
            return {
                sessionId,
                exists: false,
                history: []
            }
        }
        const message = history.filter((msg) => !(msg instanceof SystemMessage))
            .map((msg, i) => ({
                index: i + 1,
                role: msg instanceof HumanMessage ? 'user' : 'assistant',
                content: msg.content,
            }))
        return {
            sessionId,
            exists: true,
            history: message
        }
    }

    clearSession(sessionId: string) {
        if (!this.sessions.has(sessionId)) {
            return {
                sessionId,
                cleared: false,
                message: '会话不存在'
            }
        }
        this.sessions.set(sessionId, [this.systemMessage])
        return {
            sessionId,
            cleared: true,
            message: '会话已清空'
        }
    }

    listSessions() {
        const sessions = Array.from(this.sessions.entries()).map(([id, h]) => ({
            sessionId: id,
            turns: Math.floor((h.length - 1) / 2),
        }))
        return { total: sessions.length, sessions }
    }

    async chatStream(sessionId: string, message: string, res: Response) {
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('Access-Control-Allow-Origin', '*')
        const history = this.getOrCreate(sessionId)
        history.push(new HumanMessage(message))
        let fullReply = ''
        const stream = await this.llm.stream(history)
        for await (const chunk of stream) {
            if (chunk.content) {
                const text = String(chunk.content)
                fullReply += text
                res.write(`data: ${JSON.stringify({ text, sessionId })}\n\n`)
            }
        }

        // 流结束后把完整回复存入历史
        history.push(new AIMessage(fullReply))
        res.write(`data: ${JSON.stringify({ text: '[DONE]', turns: Math.floor((history.length - 1) / 2) })}\n\n`)
        res.end()
    }
}
