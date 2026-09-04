import { Annotation, END, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph';
import { ChatOllama } from '@langchain/ollama';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { config } from '../config.js';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';


// 定义全局状态
const SupervisorState = Annotation.Root({
    // 消息，复用MessagesAnnotation的messages属性，里面已经有归约函数和默认值
    messages: MessagesAnnotation.spec.messages,
    // 下一个agent名称
    nextAgent: Annotation<string>(),
    completedAgents: Annotation<string[]>({
        reducer: (prev, cur) => [...prev, ...cur],//归约函数
        default: () => [] //默认值
    })
})

@Injectable()
export class SupervisorService implements OnModuleInit {

    private graph: any

    onModuleInit() {
        // 创建 chatOllama 实例
        const llm = new ChatOllama({
            model: config.ollama.chatModel, // Ollama 模型名称
            temperature: config.ollama.temperature, // 生成文本的随机程度
            baseUrl: config.ollama.baseUrl, // Ollama 服务器地址
            think: false, // 是否开启思考模式，开启后模型会先返回一个思考中的消息，等生成完成后再返回最终回答
            numPredict: 512, // 生成文本的最大 token 数量，512 是一个比较合理的值，可以根据需要调整
        });

        // supervisor节点，决定调用哪个agent
        const supervisor = async (state: typeof SupervisorState.State) => {
            const done = state.completedAgents.length
                ? `已完成${state.completedAgents.join('、')}` : '尚未调用任何agent'

            const res = await llm.invoke(
                [
                    new SystemMessage(`你是任务协调者，管理以下专业 Agent：
                    - researcher：收集信息、搜索资料
                    - analyst：数据分析、逻辑推理
                    - writer：撰写报告、优化表达    
                    规则：
                    1. 根据任务需求按需选择 Agent
                    2. ${done}  
                    3. 所有必要工作完成后输出 FINISH
                    4. 只输出下一个 Agent 名称或 FINISH，不要其他内容
                    可选值：researcher | analyst | writer | FINISH`), ...state.messages
                ])
            // 下一个agent名称
            const nextAgent = res.content as string
            console.log('nextAgent', nextAgent)
            // 判断下一个agent名称是否有效
            const validAgent = ['researcher', 'analyst', 'writer', 'FINISH']
            const safeNextAgent = validAgent.includes(nextAgent) ? nextAgent : 'FINISH'
            return {
                // 下一个agent名称
                nextAgent: safeNextAgent,
                messages: [new AIMessage(`[Supervisor] 下一步 → ${safeNextAgent}`)],
            }
        }

        // 路由函数，根据输入返回下一个节点名称
        const routeToAgent = async (state: typeof SupervisorState.State) => {
            return state.nextAgent === 'FINISH'
                ? END : state.nextAgent
        }

        // Worker 工厂函数：生成不同角色的 worker 节点
        const workerFactory = (name: string, systemPrompt: string) => {
            return async (state: typeof SupervisorState.State) => {
                // 取第一条用户消息作为原始任务描述
                const userMessage = state.messages.find(msg => msg.type === 'human') as HumanMessage
                // 取最近 4 条消息作为上下文
                const context = state.messages.slice(-4).map(msg => msg.content).join('\n')

                const res = await llm.invoke([
                    new SystemMessage(systemPrompt),
                    new HumanMessage(`原始任务：${userMessage.content}\n\n当前上下文：\n${context}`),
                ])
                return {
                    messages: [new AIMessage(`[${name}] ${res.content}`)],
                    completedAgents: [name],
                }
            }
        }

        this.graph = new StateGraph(SupervisorState)
            .addNode('supervisor', supervisor)
            .addNode('researcher', workerFactory('researcher', '你是研究员，擅长收集整理信息，提供详细调研结果。'))
            .addNode('analyst', workerFactory('analyst', '你是分析师，擅长数据分析，提供洞察和建议。'))
            .addNode('writer', workerFactory('writer', '你是写作专家，把信息整理成清晰专业的报告。'))
            .addEdge(START, 'supervisor')
            .addConditionalEdges('supervisor', routeToAgent, {
                researcher: 'researcher',
                analyst: 'analyst',
                writer: 'writer',
                [END]: END,
            })
            // 所有 Worker 完成后都回到 supervisor，让它决定下一步
            .addEdge('researcher', 'supervisor')
            .addEdge('analyst', 'supervisor')
            .addEdge('writer', 'supervisor')
            .compile()
    }

    async run(userInput: string) {
        const result = await this.graph.invoke(
            { messages: [new HumanMessage(userInput)] },
            { recursionLimit: 30 }
        )

        const messages = result.messages as AIMessage[]
        const agentLog = messages
            .filter(m => typeof m.content === 'string' && (m.content as string).startsWith('['))
            .map(m => m.content as string)

        const writerOutputs = agentLog.filter(l => l.startsWith('[writer]'))
        const finalReport = writerOutputs.length
            ? writerOutputs.at(-1)!.replace('[writer] ', '')
            : agentLog.at(-1) ?? '无输出'

        return {
            agentLog,
            completedAgents: result.completedAgents,
            finalReport,
        }
    }
}
