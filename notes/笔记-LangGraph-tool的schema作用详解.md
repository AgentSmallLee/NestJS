# LangGraph 工具定义中 schema 的作用

> 问题：`tool()` 里的 `schema` 只是定义方法的参数吗？

## 核心结论

`schema` 不只是"定义参数"，它是工具调用机制里的**核心契约**，同时干三件事：

1. 给 LLM 看的"参数说明书"（最关键）
2. 运行时的参数校验
3. TypeScript 的类型推导

## 1. 给 LLM 看的"参数说明书"

`bindTools(tools)` 时，schema 会被转成 JSON Schema 随请求发给模型。
以 `get_weather` 工具为例，实际发给 LLM 的是：

```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "查询指定城市的当前天气",
    "parameters": {
      "type": "object",
      "properties": {
        "city": { "type": "string", "description": "城市名，如：北京、上海、武汉" }
      },
      "required": ["city"]
    }
  }
}
```

LLM 生成 `tool_calls` 时，参数就是**严格按这份 schema 造出来的**。
它看不到函数源码，`schema`（加上 `name`/`description`）就是它对工具的全部认知。
`.describe()` 里写的提示词质量，直接决定模型传参传得对不对。

## 2. 运行时的参数校验

`ToolNode` 拿到 LLM 返回的 tool_calls 后、真正执行函数前，会先用 schema 校验参数。
模型传了 `city: 123` 或漏传了字段，这里会直接报错，而不是把脏数据塞进函数。

## 3. TypeScript 的类型推导

函数参数的类型就是从 schema 反推的：

```typescript
const weatherTool = tool(
  async ({ city }) => { ... },   // ← city: string 的类型来自下面的 z.object
  {
    schema: z.object({
      city: z.string().describe('城市名，如：北京、上海、武汉'),
    }),
  }
)
```

## 三层信息各管什么

| 配置 | 给谁看 | 作用 |
|---|---|---|
| `name` | LLM | 模型决定"调用哪个工具" |
| `description` | LLM | 模型判断"什么时候该用这个工具" |
| `schema` | LLM + 运行时 | 模型知道"怎么传参" + 执行前校验参数 |

## 一句话总结

schema 定义参数的结构，但本质是 **LLM 与函数之间的机器可读协议**——
模型照着它造参数，LangChain 照着它验参数，TS 照着它推类型，
一份定义三处生效。

## 相关：工具函数可以不加 async

`tool()` 的执行函数同步、异步都可以——LangChain 内部统一 `await`，
而 `await` 非 Promise 值会原样返回。选择标准：

- **纯计算/查内存**（calculator、mock 数据）→ 同步更简洁
- **有 I/O**（真实 API、数据库、外部服务）→ 必须 `async`，
  否则返回的是 Promise 对象本身，LLM 会收到 `"[object Promise]"` 之类的内容

```typescript
// ✅ 同步写法，合法
const calculatorTool = tool(
  ({ expression }) => {
    try {
      const result = Function(`'use strict'; return (${expression})`)()
      return `计算结果：${expression} = ${result}`
    } catch (e: any) {
      return `计算错误：${e.message}`
    }
  },
  { name: 'calculator', description: '...', schema: z.object({...}) }
)
```
