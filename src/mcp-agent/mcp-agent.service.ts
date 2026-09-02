import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { ChatOllama } from '@langchain/ollama';
import { Injectable } from '@nestjs/common';
import { config } from '../config.js';
import { MultiServerMCPClient } from '@langchain/mcp-adapters'

@Injectable()
export class McpAgentService {
    private llm = new ChatOllama({
    model: config.ollama.chatModel,
    baseUrl: config.ollama.baseUrl,
    temperature: 0.1,
    think: false,
    numPredict: 1024,
  })

  // MultiServerMCPClient：同时连接多个 MCP Server
  private mcpClient: MultiServerMCPClient

  // 从 MCP 转换来的 LangChain Tools
  private mcpTools: any[] = []

  // ── 模块启动时初始化 MCP 连接 ─────────────────────
  async onModuleInit() {
    this.mcpClient = new MultiServerMCPClient({
      // 连接配置：可以同时连接多个 MCP Server
      mcpServers: {
        // 自定义的本地 MCP Server（stdio 模式）
        'local-tools': {
          transport: 'stdio',
          command: 'npx',
          args: ['tsx','src/mcp-server/server.ts'],
          env: { ...process.env } as Record<string, string>,
        },

        // 也可以连接社区现成的 MCP Server（举例，需要单独安装）
        // 'filesystem': {
        //   transport: 'stdio',
        //   command: 'npx',
        //   args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        // },
      },
    })

    // 把所有 MCP Server 的工具转成 LangChain Tools 格式
    // 之后就可以像普通 LangChain Tool 一样使用
    this.mcpTools = await this.mcpClient.getTools()

    console.log(`✅ MCP Agent 已加载 ${this.mcpTools.length} 个工具：`)
    this.mcpTools.forEach(t => console.log(`   - ${t.name}: ${t.description?.slice(0, 50)}`))
  }

  // ── Agent 执行（LLM 自主决策调用 MCP 工具）─────────
  async runAgent(userMessage: string) {
    if (!this.mcpTools.length) {
      return { error: 'MCP 工具未初始化，请稍后重试' }
    }

    // 把 MCP Tools 绑定到 LLM（和普通 LangChain Tools 完全一样）
    const llmWithTools = this.llm.bindTools(this.mcpTools)

    // 工具 Map（通过 name 找到对应 Tool 执行）
    const toolMap = Object.fromEntries(
      this.mcpTools.map(t => [t.name, t])
    )

    const messages: any[] = [
      new SystemMessage(
        `你是一个智能助手，可以使用以下工具帮助用户：
- query_users：查询用户数据库
- read_file：读取项目文件
- write_file：写入文件
- get_weather：查询城市天气

根据用户的问题，选择合适的工具获取信息后回答。用中文回答。`
      ),
      new HumanMessage(userMessage),
    ]

    const steps: string[] = []
    let roundCount = 0

    // Agent 决策循环
    while (roundCount < 6) {
      roundCount++
      const response = await llmWithTools.invoke(messages)
      messages.push(response)

      // 没有工具调用 → 有最终答案
      if (!response.tool_calls?.length) {
        steps.push(`💬 [最终回答] ${response.content}`)
        break
      }

      // 执行 MCP 工具调用
      for (const toolCall of response.tool_calls) {
        steps.push(`🔧 [调用MCP工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`)

        const toolFn = toolMap[toolCall.name]
        if (!toolFn) {
          const errMsg = `工具不存在：${toolCall.name}`
          steps.push(`❌ [错误] ${errMsg}`)
          messages.push(new ToolMessage({
            content: errMsg,
            tool_call_id: toolCall.id ?? '',
          }))
          continue
        }

        // 调用 MCP 工具（底层通过 MCP 协议发请求给 Server）
        const result = await toolFn.invoke(toolCall.args)
        steps.push(`✅ [工具结果] ${String(result).slice(0, 200)}`)

        messages.push(new ToolMessage({
          content: String(result),
          tool_call_id: toolCall.id ?? '',
        }))
      }
    }

    const lastAI = [...messages].reverse().find(m => m instanceof AIMessage)

    return {
      userMessage,
      steps,
      totalRounds: roundCount,
      answer: lastAI?.content ?? '抱歉，无法完成请求',
    }
  }

  // ── 只获取工具列表（不执行）──────────────────────
  async listMcpTools() {
    return this.mcpTools.map(t => ({
      name: t.name,
      description: t.description,
    }))
  }

  async onModuleDestroy() {
    await this.mcpClient.close()
  }
}
