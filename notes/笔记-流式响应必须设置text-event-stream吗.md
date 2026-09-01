# 流式响应必须设置 `Content-Type: text/event-stream` 吗？

## 简短回答

**不一定，取决于你用的是哪种流式方案。**

`text/event-stream` 是 **SSE（Server-Sent Events）** 协议规定的 Content-Type，不是所有流式响应都需要。

---

## 常见的流式方案对比

| 方案 | Content-Type | 协议格式 | 前端接收方式 |
|------|-------------|---------|-------------|
| **SSE** | `text/event-stream` | `data: xxx\n\n` 格式 | `EventSource` API |
| **Chunked (原始分片)** | 普通类型（如 `text/plain`、`application/json`）或不设置 | 无固定格式，TCP 分片传输 | `fetch` + `ReadableStream` |
| **NDJSON / JSON Lines** | `application/x-ndjson` | 每行一个 JSON 对象 | `fetch` + 逐行解析 |
| **WebSocket** | （握手时是 HTTP，之后走 WS 协议） | WebSocket 帧 | `WebSocket` API |

---

## 1. SSE —— 必须设置 `text/event-stream`

**SSE（Server-Sent Events）** 是 W3C 标准的服务器推送协议，有严格的格式要求：

- Content-Type **必须**是 `text/event-stream`
- 数据格式必须是 `data: xxx\n\n`（以双换行分隔事件）
- 浏览器的 `EventSource` API 只能识别这种格式

当前项目 `chatStream` 中：

```ts
res.setHeader('Content-Type', 'text/event-stream')
// ...
res.write(`data: ${JSON.stringify({ text, sessionId })}\n\n`)
```

这里用的是 SSE 格式，所以**必须设置** `text/event-stream`，否则：
- 浏览器 `EventSource` 无法正确解析
- 某些代理/中间件可能会缓冲响应，导致流式效果失效

同时配套的 SSE 响应头还有：
```ts
res.setHeader('Cache-Control', 'no-cache')   // 禁止缓存，确保实时性
res.setHeader('Connection', 'keep-alive')     // 保持连接（HTTP/1.1 实际默认就是这个）
```

---

## 2. Chunked 流式 —— 不需要 `text/event-stream`

如果你只是想让数据**分片到达**，不要求 SSE 格式，可以用普通的 `Transfer-Encoding: chunked`：

```ts
// 服务端
res.setHeader('Content-Type', 'text/plain') // 或者 application/json
res.write('第一个分片')
res.write('第二个分片')
res.end()
```

前端用 `fetch` + `ReadableStream` 接收：

```js
const response = await fetch('/api/chat-stream')
const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
    const { value, done } = await reader.read()
    if (done) break
    console.log(decoder.decode(value)) // 收到一个分片
}
```

这种方式：
- ✅ 更灵活，数据格式自定义
- ✅ 支持 POST 请求（SSE 的 `EventSource` 只能发 GET）
- ❌ 没有内置的重连机制（SSE 有自动重连）
- ❌ 需要自己处理分片拼接和解析

---

## 3. 那是不是"流式就必须设"？

**不是。** 总结一下：

| 场景 | 是否必须 `text/event-stream` |
|------|-----------------------------|
| 使用 SSE 协议 + `EventSource` | ✅ 必须 |
| 使用 fetch + ReadableStream 自定义分片 | ❌ 不需要，用你自己的 Content-Type |
| WebSocket 流式 | ❌ 不是 HTTP 响应体的事 |
| 文件下载流式（pipe） | ❌ 用对应的文件类型即可 |

---

## 当前项目为什么设置了？

因为 `chatStream` 方法：
1. 用了 SSE 的数据格式 `data: xxx\n\n`
2. 前端预期用 `EventSource` 或按 SSE 格式解析

所以设置 `text/event-stream` 是**正确且必要**的。

---

## 额外提醒：NestJS 内置的 SSE 支持

NestJS 其实提供了 `@Sse` 装饰器，比手动写 `@Res()` 更优雅：

```ts
import { Sse, MessageEvent } from '@nestjs/common'
import { Observable, interval, map } from 'rxjs'

@Sse('chat-stream')
chatStream(): Observable<MessageEvent> {
    // 返回 Observable，NestJS 自动处理 SSE 格式和响应头
    return fromAsyncIterable(stream).pipe(
        map(chunk => ({ data: { text: chunk.content } }))
    )
}
```

用 `@Sse()` 的话，`Content-Type` 和 SSE 格式 NestJS 会自动处理，不需要手动设置。
