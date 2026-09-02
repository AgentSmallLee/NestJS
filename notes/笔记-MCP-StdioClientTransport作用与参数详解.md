# StdioClientTransport 作用与参数详解

## 一、作用

`StdioClientTransport` 是 MCP（Model Context Protocol）SDK 提供的**客户端传输层实现**，用于通过 **stdio（标准输入/输出）** 方式与 MCP Server 进行通信。

核心工作方式：
1. 客户端（NestJS 主进程）以**子进程**的方式启动 MCP Server
2. 通过子进程的 `stdin`（标准输入）发送请求消息
3. 通过子进程的 `stdout`（标准输出）接收响应消息
4. 基于 JSON-RPC 协议进行消息交互

> 适用场景：MCP Server 与 Client 运行在同一台机器上，通过进程间通信（IPC）方式交互，不需要网络端口。

---

## 二、构造函数参数（StdioServerParameters）

`StdioClientTransport` 的构造函数接收一个 `StdioServerParameters` 对象，包含以下参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `command` | `string` | ✅ 是 | - | 要执行的可执行命令，用于启动 MCP Server 进程 |
| `args` | `string[]` | ❌ 否 | `[]` | 传递给可执行命令的命令行参数数组 |
| `env` | `Record<string, string>` | ❌ 否 | `getDefaultEnvironment()` | 子进程的环境变量。不指定时使用安全的默认环境变量集合 |
| `stderr` | `IOType \| Stream \| number` | ❌ 否 | `"inherit"` | 子进程 stderr 的处理方式，语义同 Node.js `child_process.spawn` |
| `cwd` | `string` | ❌ 否 | 当前工作目录 | 子进程的工作目录 |
| `maxBufferSize` | `number` | ❌ 否 | `10 * 1024 * 1024`（10MB） | 读取缓冲区的最大字节数，单条消息超过此大小会报错并关闭连接 |

---

## 三、参数详细说明

### 1. `command`（命令）
启动 MCP Server 的可执行文件路径或命令名。

常见取值：
- `'npx'` — 通过 npx 运行 Node.js 脚本
- `'node'` — 直接运行 Node.js 文件
- `'python'` / `'python3'` — 运行 Python 脚本
- 其他任意可执行文件路径

### 2. `args`（参数数组）
传递给 `command` 的命令行参数。

示例：
```typescript
// 等同于执行: npx tsx src/mcp-server/server.ts
{
  command: 'npx',
  args: ['tsx', 'src/mcp-server/server.ts'],
}
```

### 3. `env`（环境变量）
子进程的环境变量对象。

- **不指定**：使用 `getDefaultEnvironment()`，仅继承安全的默认环境变量（`DEFAULT_INHERITED_ENV_VARS`）
- **自定义**：传入完整的环境变量对象，例如 `{ ...process.env }` 继承所有父进程环境变量

> ⚠️ 注意：如果 MCP Server 需要访问 `DATABASE_URL`、API Key 等环境变量，必须通过 `env` 传递给子进程，否则子进程读取不到。

### 4. `stderr`（标准错误处理）
控制子进程 stderr 的输出方式，取值与 Node.js `child_process.spawn` 的 `stdio` 选项一致：

- `"inherit"`（默认）：子进程 stderr 直接输出到父进程的 stderr（控制台可见）
- `"pipe"`：创建管道，可通过 `transport.stderr` 属性读取
- `"ignore"`：忽略 stderr 输出
- `"overlapped"`：Windows 上的重叠 I/O 模式
- `Stream` / `number`：直接传入流或文件描述符

### 5. `cwd`（工作目录）
子进程启动时的工作目录。不指定则继承父进程的当前工作目录。

### 6. `maxBufferSize`（缓冲区大小）
读取缓冲区的最大字节数。

- 默认：`10 * 1024 * 1024` 字节（10 MB）
- 如果单条 JSON-RPC 消息超过此大小，transport 会触发错误并关闭连接

---

## 四、实例属性与方法

### 属性
| 属性 | 类型 | 说明 |
|------|------|------|
| `onclose` | `() => void` | 连接关闭时的回调 |
| `onerror` | `(error: Error) => void` | 发生错误时的回调 |
| `onmessage` | `(message: JSONRPCMessage) => void` | 收到消息时的回调 |
| `stderr` | `Stream \| null` | 子进程的 stderr 流（仅当 stderr 设为 `"pipe"` 或 `"overlapped"` 时可用） |
| `pid` | `number \| null` | 子进程的 PID（启动后可用） |

### 方法
| 方法 | 说明 |
|------|------|
| `start(): Promise<void>` | 启动子进程并准备通信 |
| `close(): Promise<void>` | 关闭连接和子进程 |
| `send(message: JSONRPCMessage): Promise<void>` | 发送 JSON-RPC 消息 |

---

## 五、项目中的实际使用

在 `src/mcp-client/mcp-client.service.ts` 中：

```typescript
this.transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/mcp-server/server.ts'],
    env: { ...process.env } as Record<string, string>,
})

await this.client.connect(this.transport)
```

这段代码的含义：
1. **command: 'npx'** — 使用 npx 命令启动 server
2. **args: ['tsx', 'src/mcp-server/server.ts']** — 用 tsx 运行 TypeScript 编写的 MCP Server
3. **env: { ...process.env }** — 将当前 NestJS 进程的所有环境变量传给子进程（确保 `DATABASE_URL` 等变量可用）
4. `client.connect(transport)` — MCP Client 通过该 transport 与 Server 建立连接

---

## 六、与其他 Transport 的区别

MCP SDK 中还有其他传输方式：
- **StdioClientTransport** — 本地子进程 stdio 通信（同一机器）
- **StreamableHTTPClientTransport** — 通过 HTTP 流式传输（远程）
- **SSEClientTransport** — 通过 Server-Sent Events 通信（远程）
- **InMemoryTransport** — 内存中直接调用（测试用）

选择 stdio 的优势：无需网络端口、启动简单、安全性高（仅本地进程通信）。
