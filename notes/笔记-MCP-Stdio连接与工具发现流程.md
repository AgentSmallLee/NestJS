# MCP Stdio 连接与工具发现流程

## 一、核心结论

**StdioClientTransport 方式连接 MCP Server，是有工具发现流程的。** 工具发现是 MCP 协议层的概念，与传输层（stdio / HTTP / SSE）无关——不管用哪种 Transport，工具发现都需要客户端主动触发，`connect()` 本身不会自动做。

---

## 二、MCP 协议标准初始化流程

```
Client                                Server
  │                                    │
  ├── initialize (能力协商) ───────────►│
  │◄─────── initialize result ─────────┤
  ├── initialized (通知) ─────────────►│
  │                                    │
  ├── tools/list (工具发现) ──────────►│  ← 主动调用，不是自动的
  │◄────────── tools result ───────────┤
  │                                    │
  ├── tools/call (调用工具) ───────────►│
  │◄────────── call result ────────────┤
```

两个阶段的区别：

| 阶段 | 触发方式 | 作用 |
|------|----------|------|
| initialize / initialized | `connect()` 内部自动完成 | 协议版本协商、能力声明、建立会话 |
| tools/list | 客户端主动调用 `listTools()` | 获取 Server 提供的所有工具列表 |

---

## 三、为什么 `connect()` 不自动做工具发现？

SDK 设计上的考量：

1. **按需发现**：有些客户端只用到资源（resources）或提示（prompts），不需要工具能力，没必要多一次 round-trip
2. **动态变化**：工具列表可能动态增减，客户端应在需要时主动刷新，而不是只在连接时拿一次
3. **能力分层**：initialize 只协商"支不支持工具"这个能力，具体有哪些工具是独立查询

---

## 四、本项目中的两种实现对比

项目中有两个 MCP 客户端模块，都用 stdio 连接同一个 Server，但工具发现的时机不同：

### 1. 原生 SDK 客户端（`src/mcp-client/`）

`mcp-client.service.ts` 中：

- **连接时**：`onModuleInit` 里调用 `client.connect(transport)`，只做 initialize 握手
- **工具发现**：通过 `listTools()` 方法按需调用，对应 HTTP 端点 `GET /mcp-client/tools`

```typescript
// 连接 —— 只做协议握手
await this.client.connect(this.transport)

// 工具发现 —— 按需调用，不自动执行
async listTools() {
    const response = await this.client.listTools()
    return response.tools
}
```

### 2. LangChain Agent 客户端（`src/mcp-agent/`）

`mcp-agent.service.ts` 中：

- **工具发现**：`onModuleInit` 里调用 `mcpClient.getTools()`，**启动时就自动完成**工具发现，并把 MCP tools 转成 LangChain Tool 格式缓存起来

```typescript
// onModuleInit 中一次性完成连接 + 工具发现
this.mcpTools = await this.mcpClient.getTools()
```

### 对比总结

| 模块 | 工具发现时机 | 是否缓存工具 | 适用场景 |
|------|-------------|-------------|----------|
| `mcp-client` | 按需调用 | 不缓存 | 直接暴露 MCP 能力给前端 |
| `mcp-agent` | 启动时自动发现 | 缓存到 `this.mcpTools` | Agent 自主决策调用工具 |

---

## 五、传输层不影响协议流程

StdioClientTransport 只是传输层的一种实现，它负责：
1. 以子进程方式启动 Server
2. 通过 stdin 发消息、stdout 收消息
3. 处理 JSON-RPC 消息的序列化/反序列化

**工具发现（tools/list）是 MCP 协议层的行为，跟用 stdio、HTTP 还是 SSE 传输没有关系。** 换一种 Transport，协议流程完全一样。

其他 Transport：
- `StreamableHTTPClientTransport` — HTTP 流式传输（远程 Server）
- `SSEClientTransport` — Server-Sent Events（远程 Server）
- `InMemoryTransport` — 内存直接调用（测试用）

---

## 六、验证方法

想确认工具发现确实发生了，可以调用项目中的接口：

```bash
# 原生 SDK 客户端的工具列表
curl http://localhost:3000/mcp-client/tools

# LangChain Agent 的工具列表
curl http://localhost:3000/mcp-agent/tools
```

能返回 `database-query`、`read-file`、`weather-query` 三个工具，说明工具发现流程正常工作。

---

## 七、常见误区

❌ **误区**：Stdio 模式没有工具发现，HTTP 模式才有
✅ **真相**：工具发现是协议层行为，跟传输层无关，所有 Transport 都有 `tools/list`

❌ **误区**：`connect()` 之后工具就应该已经加载好了
✅ **真相**：`connect()` 只做握手，工具发现需要单独调用 `listTools()`（LangChain adapter 是封装了自动调用，才让人误以为是 connect 自带的）

❌ **误区**：工具列表在连接时就固定了
✅ **真相**：Server 可以动态注册/注销工具，客户端应该在需要时刷新工具列表
