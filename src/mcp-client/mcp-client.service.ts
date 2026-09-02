import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

type TextContent = { type: 'text'; text: string }

@Injectable()
export class McpClientService {
    private client: Client
    private transport: StdioClientTransport

    // ── 模块启动时连接 MCP Server ──────────────────────
    async onModuleInit() {
        this.client = new Client(
            {
                name: 'nestjs-mcp-client',
                description: 'NestJS MCP Client',
                version: '1.0.0'
            },
            { capabilities: {} },
        )

        // stdio 模式：NestJS 以子进程方式启动 MCP Server
        this.transport = new StdioClientTransport({
            command: 'npx',
            args: ['tsx', 'src/mcp-server/server.ts'],
            // 把当前环境变量传给子进程（包含 DATABASE_URL 等）
            env: { ...process.env } as Record<string, string>,
        })

        await this.client.connect(this.transport)
        console.log('✅ MCP Client 已连接到 MCP Server')
    }

    // ── 获取所有可用工具列表 ──────────────────────────
    async listTools() {
        const response = await this.client.listTools()
        return response.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        }))
    }

    // ── 调用指定工具 ──────────────────────────────────
    async callTool(toolName: string, args: Record<string, any>) {
        const response = await this.client.callTool({
            name: toolName,
            arguments: args,
        })
        // MCP 响应里 content 是数组，取第一个 text 内容
        console.log(response)
        const content = response.content as TextContent[]
        const textContent = content.find(c => c.type === 'text')
        return {
            tool: toolName,
            result: textContent?.text ?? '工具无返回内容',
            isError: response.isError ?? false,
        }
    }

    // ── 应用退出时断开连接 ─────────────────────────────
    async onModuleDestroy() {
        await this.client.close()
        console.log('MCP Client 已断开连接')
    }
}
