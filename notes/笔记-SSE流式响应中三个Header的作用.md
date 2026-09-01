# SSE 流式响应中三个关键 Header 的作用

在 SSE（Server-Sent Events）流式响应中，通常会设置以下三个响应头。它们各自有不同的作用，但**并不是所有都绝对必要**。

---

## 1. `Cache-Control: no-cache`

### 作用
告诉浏览器和中间代理**不要缓存**这个响应，每次都要从服务器获取最新数据。

### 为什么 SSE 需要它
SSE 的核心是**实时推送**，如果响应被缓存了：
- 浏览器可能直接读缓存，收不到新推送的数据
- 中间代理（Nginx、CDN 等）可能缓冲整个响应才转发，流式效果就失效了

### 是否必须
**强烈建议设置，但不是 SSE 协议强制要求。** 不设的话，某些环境下可能出现"流不出来"或数据延迟的问题。

### 常见的更完整写法
```ts
res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
// no-cache: 可以缓存，但使用前必须验证
// no-store: 完全不缓存
// must-revalidate: 资源过期后必须重新验证
```

---

## 2. `Connection: keep-alive`

### 作用
告诉服务器**保持 TCP 连接不断开**，客户端可以在同一个连接上继续发请求，服务端也可以持续推送数据。

### 为什么 SSE 需要它
SSE 是一个**长连接**，服务器要持续往连接里写数据。如果连接是短连接，响应一写完就断了，流就没法继续了。

### 是否必须
**在 HTTP/1.1 中默认就是 keep-alive，通常可以不写。** 但显式设置一下更稳妥，特别是：
- 兼容一些旧的 HTTP/1.0 客户端
- 防止某些中间件/代理把 Connection 改成 close

### HTTP/2 注意事项
HTTP/2 中 `Connection` 头是**被禁止的**（多路复用本身就保持连接），设置了可能会被忽略或报错。不过大多数反向代理会自动处理这个问题。

---

## 3. `Access-Control-Allow-Origin: *`

### 作用
**CORS（跨域资源共享）**头，允许所有来源的页面访问这个接口。

### 为什么 SSE 场景下会有它
如果前端页面和 SSE 接口**不在同一个域名/端口**下，浏览器的同源策略会阻止 `EventSource` 连接，需要通过 CORS 放行。

### 是否必须
**只有跨域时才需要。** 如果前后端同域，不需要设置。

### ⚠️ 安全提醒
`*` 表示**允许任何网站**访问，生产环境建议指定具体域名：
```ts
res.setHeader('Access-Control-Allow-Origin', 'https://your-frontend.com')
```

另外，`EventSource` 默认不发送 cookie，如果需要带凭证：
- 服务端不能用 `*`，必须指定具体 origin
- 还要设置 `Access-Control-Allow-Credentials: true`
- 前端 `EventSource` 初始化时加 `{ withCredentials: true }`

---

## 总结表

| Header | 作用 | SSE 是否必须 | 备注 |
|--------|------|-------------|------|
| `Content-Type: text/event-stream` | 声明 SSE 协议格式 | ✅ 必须 | SSE 协议要求 |
| `Cache-Control: no-cache` | 禁止缓存，确保实时 | ⚠️ 强烈建议 | 不设可能被代理缓冲 |
| `Connection: keep-alive` | 保持长连接 | ❌ HTTP/1.1 默认就是 | 显式写更稳妥 |
| `Access-Control-Allow-Origin: *` | 允许跨域访问 | ❌ 仅跨域时需要 | 生产环境别用 `*` |

---

## 当前项目中的设置

```ts
res.setHeader('Content-Type', 'text/event-stream')
res.setHeader('Cache-Control', 'no-cache')
res.setHeader('Connection', 'keep-alive')
res.setHeader('Access-Control-Allow-Origin', '*')
```

- 前两个是 SSE 的标准配置，合理
- `Connection: keep-alive` 属于锦上添花，没问题
- `Access-Control-Allow-Origin: *` 方便本地开发调试，但上线前建议改成具体域名，或者放到全局 CORS 中间件里统一处理（NestJS 有 `enableCors()` 方法）
