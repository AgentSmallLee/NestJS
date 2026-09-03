# LangGraph + Ollama 模型 404 报错解决方案

## 报错信息

```
NotFoundError: 404 404 page not found
lc_error_code: 'MODEL_NOT_FOUND'
```

报错堆栈显示请求来自 `@langchain/openai` 的 `ChatOpenAI`，调用 Ollama 时返回 404。

## 报错原因

**Ollama 的 OpenAI 兼容 API 路径需要 `/v1` 后缀。**

- `ChatOpenAI` 默认会向 `{baseURL}/chat/completions` 发送请求
- Ollama 的 OpenAI 兼容接口路径是 `http://localhost:11434/v1/chat/completions`
- 如果 `baseURL` 只配置为 `http://localhost:11434`（缺少 `/v1`），实际请求路径变成 `http://localhost:11434/chat/completions`，Ollama 无法识别该路径，返回 404

## 错误配置

```typescript
// src/config.ts
langGraph: {
    baseURL: 'http://localhost:11434',  // ❌ 缺少 /v1
}
```

## 解决方案

在 `baseURL` 末尾加上 `/v1` 后缀：

```typescript
// src/config.ts
langGraph: {
    baseURL: 'http://localhost:11434/v1',  // ✅ 加上 /v1
}
```

## 涉及文件

- `src/config.ts` — LangGraph 配置中的 `baseURL`
- `src/langgraph/langgraph.service.ts` — 使用 `ChatOpenAI` 初始化模型

## 补充说明

- Ollama 从 0.1.25 版本开始支持 OpenAI 兼容 API
- 兼容端点统一在 `/v1` 路径下，包括：
  - `/v1/chat/completions` — 聊天补全
  - `/v1/completions` — 文本补全
  - `/v1/embeddings` — 嵌入
- 任何使用 OpenAI SDK 或 `@langchain/openai` 对接 Ollama 的场景，`baseURL` 都需要加上 `/v1`
