import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai'
import { config } from '../config.js';
import {
    StateGraph,
    START,
    END,
    MessagesAnnotation,
    MemorySaver,
} from '@langchain/langgraph'
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

@Injectable()
export class LanggraphService implements OnModuleInit {

    async history(threadId: string) {
        // getState 获取某个 thread 当前保存的完整状态
        const state = await this.memoryGraph.getState({
            configurable: { thread_id: threadId },
        })
        console.log(state)
        return (state.values.messages ?? []).map((m: any, i: number) => ({
            index: i,
            role: m._getType?.() === 'human' ? 'user' : 'assistant',
            content: m.content,
        }))
    }

    private simpleGraph: any

    private memoryGraph: any

    async onModuleInit() {
        const llm = new ChatOpenAI({
            model: config.langGraph.model,
            apiKey: config.langGraph.apiKey,
            configuration: { baseURL: config.langGraph.baseURL },
            temperature: config.langGraph.temperature
        })

        type NewType = typeof MessagesAnnotation.State;

        // ── 工作流一：无记忆，每次 invoke 独立 ─────────────
        const callModel = async (state: NewType) => {
            // state.messages 包含本次传入的所有消息
            const response = await llm.invoke(state.messages)
            // 只返回新增消息，LangGraph 自动追加（不覆盖历史）
            return { messages: [response] }
        }

        this.simpleGraph = new StateGraph(MessagesAnnotation)
            .addNode('callModel', callModel)
            .addEdge(START, 'callModel')
            .addEdge('callModel', END)
            .compile()

        // ── 工作流二：有记忆，同 threadId 共享历史 ──────────
        const callModelWithMemory = async (state: typeof MessagesAnnotation.State) => {
            const recentMessages = state.messages
            const messages = [
                new SystemMessage('你是专业的 AI 助手，请记住对话上下文。'),
                ...recentMessages,   // 展开全部历史，让 LLM 看到完整上下文
            ]
            const response = await llm.invoke(messages)
            return { messages: [response] }
        }

        this.memoryGraph = new StateGraph(MessagesAnnotation)
            .addNode('callModel', callModelWithMemory)
            .addEdge(START, 'callModel')
            .addEdge('callModel', END)
            .compile({ checkpointer: new MemorySaver() })  // 传入 checkpointer 开启记忆
        console.log(`✅ LangGraph 初始化完成，模型：${config.langGraph.model}`)
    }


    async simpleChat(message: string) {
        const result = await this.simpleGraph.invoke({
            messages: [
                new SystemMessage('你是专业的 AI 助手，回答简洁清晰。'),
                new HumanMessage(message),
            ],
        })
        return result.messages.at(-1).content as string
    }

    async memoryChat(message: string, threadId: string) {
        const result = await this.memoryGraph.invoke(
            { messages: [new HumanMessage(message)] },
            { configurable: { thread_id: threadId } },   // thread_id 区分不同会话
        )
        return result.messages.at(-1).content as string
    }
}
