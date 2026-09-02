# MCP Server: Python vs TypeScript API 区别

## 一、包与安装

### TypeScript（Node.js）

```bash
npm install @modelcontextprotocol/sdk
# 或 pnpm add @modelcontextprotocol/sdk
```

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'   // 参数校验用 zod
```

- 包名：`@modelcontextprotocol/sdk`
- 校验库：zod（第三方，需要单独安装）

### Python

Python 有两种主流写法：**`mcp` 官方 SDK（FastMCP 风格）** 和 **LangChain 风格**。

#### 方式一：`mcp` 包（官方推荐，FastMCP）

```bash
pip install mcp
```

```python
from mcp.server.fastmcp import FastMCP
```

- 包名：`mcp`
- FastMCP 是高层封装，类似 FastAPI，用装饰器注册工具，非常简洁。
- 参数校验用 **Pydantic**（Python 生态标配），FastMCP 会自动从函数签名 + 类型注解推导 schema。

#### 方式二：底层 `McpServer` 类（与 TS 风格更像）

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server
```

- 更接近 TS 的 `McpServer` 写法，手动注册工具、手动写 schema。

---

## 二、创建 Server 实例

### TypeScript

```ts
const server = new McpServer({
  name: 'my-mcp-server',
  version: '1.0.0',
  // 可选：capabilities、instructions 等
})
```

- 构造参数是一个对象：`{ name, version, capabilities?, instructions? }`
- 没有"自动从函数推导"的能力，schema 必须手写 zod。

### Python — FastMCP（最常用）

```python
mcp = FastMCP("my-mcp-server")   # 一行搞定
```

或带更多参数：

```python
mcp = FastMCP(
    name="my-mcp-server",
    instructions="这是一个示例 MCP 服务器",
    host="0.0.0.0",
    port=8000,
)
```

### Python — 底层 Server 类

```python
server = Server("my-mcp-server")
```

---

## 三、注册工具（Tool）

这是两种语言 API 风格差异最大的地方。

### TypeScript：`server.registerTool()`

```ts
server.registerTool(
  'weather-query',                      // 工具名
  {
    description: '查询天气',              // 描述
    inputSchema: z.object({              // 参数 schema（zod）
      location: z.string().describe('查询的天气地点'),
    }),
  },
  async (args) => {                      // 实现函数
    const result = await handleWeather(args.location)
    return {
      content: [{ type: 'text', text: result }],
    }
  },
)
```

特点：
- **显式三段式**：名称 → 元信息（description + inputSchema）→ handler 函数
- `inputSchema` 用 **zod** 定义，必须手动写
- 返回值格式固定：`{ content: Array<{ type: 'text', text: string }>, isError?: boolean }`

### Python — FastMCP：`@mcp.tool()` 装饰器

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("weather-server")

@mcp.tool()
def weather_query(location: str) -> str:
    """查询天气

    Args:
        location: 查询的天气地点
    """
    return f"query weather for {location}"
```

特点：
- **装饰器风格**，类似 FastAPI 的 `@app.get()`
- **自动推导 schema**：从函数签名（类型注解）+ docstring 自动生成 `name`、`description`、`inputSchema`
- 返回值可以直接是 `str` / `dict` / `list`，FastMCP 会自动包装成 MCP 标准响应格式
- 也支持手动指定描述：`@mcp.tool(description="查询天气")`

### Python — 底层 Server 类（与 TS 风格对应）

```python
from mcp.server import Server
from mcp.types import Tool, TextContent
from mcp.server.stdio import stdio_server
import json

server = Server("my-server")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="weather-query",
            description="查询天气",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "查询的天气地点"}
                },
                "required": ["location"],
            },
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "weather-query":
        location = arguments.get("location", "")
        return [TextContent(type="text", text=f"query weather for {location}")]
    raise ValueError(f"Unknown tool: {name}")
```

特点：
- 与 TS 最接近的写法，分 `list_tools` 和 `call_tool` 两个 handler
- schema 是普通 dict（JSON Schema 格式），不需要 zod/pydantic
- 更底层、更灵活，但样板代码更多

---

## 四、启动 Server（传输方式）

两种语言都支持 **stdio** 和 **SSE** 两种主要传输方式。

### TypeScript

#### stdio 方式（本项目用的方式）

```ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

async function startServer() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log('MCP Server started')
}

startServer()
```

- 先创建 transport，再 `server.connect(transport)`
- `connect()` 是挂起的，stdio 连接断开才返回

#### SSE / HTTP 方式

```ts
// 需要搭配框架如 Express / Hono 等使用
// 用 StreamableHTTPServerTransport
```

### Python — FastMCP

#### stdio 方式

```python
if __name__ == "__main__":
    mcp.run()          # 默认就是 stdio
```

或显式指定：

```python
mcp.run(transport="stdio")
```

#### SSE 方式

```python
if __name__ == "__main__":
    mcp.run(transport="sse")
    # 默认监听 http://0.0.0.0:8000/mcp
```

FastMCP 的 `run()` 方法一键选择传输方式，非常简洁。

### Python — 底层 Server 类（stdio）

```python
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

asyncio.run(main())
```

---

## 五、资源（Resources）与提示（Prompts）

MCP 协议不止 Tool，还有 Resource 和 Prompt 两种能力。

### TypeScript

```ts
// 注册资源
server.registerResource(
  'docs://intro',
  {
    description: '介绍文档',
    mimeType: 'text/markdown',
  },
  async (uri) => {
    return { contents: [{ uri, text: '# Hello MCP' }] }
  }
)

// 注册提示模板
server.registerPrompt(
  'code-review',
  { description: '代码审查提示' },
  async (args) => {
    return {
      messages: [{ role: 'user', content: { type: 'text', text: '请审查以下代码...' } }]
    }
  }
)
```

### Python — FastMCP

```python
# 资源
@mcp.resource("docs://intro")
def get_intro() -> str:
    return "# Hello MCP"

# 提示模板
@mcp.prompt()
def code_review(code: str) -> str:
    return f"请审查以下代码：\n{code}"
```

同样是装饰器风格，从函数签名自动推导。

---

## 六、错误处理

### TypeScript

```ts
return {
  content: [{ type: 'text', text: `出错了：${error.message}` }],
  isError: true,      // 通过 isError 字段标识错误
}
```

- 不抛异常，返回时加 `isError: true`

### Python — FastMCP

```python
# 方式一：直接抛出异常，FastMCP 会自动转为错误响应
raise ValueError("参数不合法")

# 方式二：返回 ToolResult（底层方式）
from mcp.types import TextContent, ToolResult

return ToolResult(
    content=[TextContent(type="text", text="出错了")],
    isError=True,
)
```

---

## 七、对比总结表

| 维度 | TypeScript SDK | Python FastMCP | Python 底层 Server |
|------|---------------|----------------|-------------------|
| **包名** | `@modelcontextprotocol/sdk` | `mcp` | `mcp` |
| **创建实例** | `new McpServer({ name, version })` | `FastMCP(name)` | `Server(name)` |
| **注册工具** | `server.registerTool(name, meta, handler)` | `@mcp.tool()` 装饰器 | `@server.list_tools()` + `@server.call_tool()` |
| **参数 schema** | zod 手动定义 | 从类型注解自动推导 | JSON Schema dict 手动写 |
| **返回值格式** | 必须是 `{ content: [...] }` 格式 | 直接返回 str/dict，自动包装 | 返回 `list[TextContent]` |
| **启动 stdio** | `new StdioServerTransport()` + `server.connect(t)` | `mcp.run()` | `stdio_server()` + `server.run()` |
| **启动 SSE** | 需手动搭建 HTTP 服务 | `mcp.run(transport="sse")` | 需手动搭建 |
| **资源注册** | `server.registerResource()` | `@mcp.resource()` 装饰器 | 手动实现 handler |
| **提示注册** | `server.registerPrompt()` | `@mcp.prompt()` 装饰器 | 手动实现 handler |
| **错误处理** | 返回 `{ isError: true }` | 直接 `raise` 异常 | 返回 `ToolResult(isError=True)` |
| **风格** | 显式、命令式 | 声明式、装饰器（类似 FastAPI） | 底层、灵活 |

---

## 八、选型建议

1. **快速开发 / 简单工具**：Python 的 **FastMCP** 最爽，装饰器 + 自动推导，代码量最少。
2. **TypeScript 全栈项目**：用 `@modelcontextprotocol/sdk` 的 `McpServer`，类型统一。
3. **需要精细控制 / 特殊传输协议**：两种语言的底层 API 都可以，TS 的 `McpServer` 和 Python 的 `Server` 类设计思路基本一致。
4. **与 NestJS 集成**：TS SDK 天然契合，本项目就是这种模式（`src/mcp-server/server.ts`）。
