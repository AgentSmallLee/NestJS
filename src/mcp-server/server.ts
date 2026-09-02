import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { handleDatabaseQuery } from './tools/database.tool.js'
import { handleFileOperation } from './tools/file.tool.js'
import { handleWeatherQuery } from './tools/weather.tool.js'

const server = new McpServer({
  name: 'my-mcp-server',
  version: '1.0.0'
})

// 工具1. 查询数据库
server.registerTool(
  'database-query',
  {
    description: '查询数据库中的用户，根据用户名、角色、数量等条件进行查询',
    inputSchema: z.object({
      name: z.string().optional().describe('查询的用户'),
      role: z.string().optional().describe('查询的用户角色'),
      limit: z.number().optional().describe('查询的用户数量'),
    }),
  },
  async (args) => {
    try {
      const result = await handleDatabaseQuery(args)
      return {
        content: [{ type: 'text', text: result }],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `an error occurred while querying the database: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)

// 工具2. 读文件
server.registerTool(
  'read-file',
  {
    description: '读取文件内容',
    inputSchema: z.object({
      filePath: z.string().describe('文件路径'),
    }),
  },
  async (args) => {
    try {
      const result = await handleFileOperation({ operation: 'read', filePath: args.filePath })
      return {
        content: [{ type: 'text', text: result }],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `an error occurred while reading the file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)

// 工具3. 天气查询
server.registerTool(
  'weather-query',
  {
    description: '查询天气',
    inputSchema: z.object({
      location: z.string().describe('查询的天气地点'),
    }),
  },
  async (args) => {
    try {
      const result = await handleWeatherQuery({ location: args.location })
      return {
        content: [{ type: 'text', text: result }],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `an error occurred while querying the weather: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)

// 启动服务
async function startServer() {
  try {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.log('MCP Server started')
  } catch (error) {
    console.error('Error starting server:', error)
  }
}

startServer().catch(console.error)
