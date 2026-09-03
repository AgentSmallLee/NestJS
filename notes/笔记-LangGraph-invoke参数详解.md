# StateGraph 的 invoke 接受什么参数

> 以 `StateGraph(MessagesAnnotation).compile()` 后的 `graph.invoke(...)` 为例。

## 总体结构

```typescript
await graph.invoke(input, config?)
```

- **参数一 `input`**：State 的初始值（增量），形状由编译图用的 Annotation 决定
- **参数二 `config`**：运行时配置（`RunnableConfig`），全部可选

## 参数一：input —— State 的初始值

只传需要赋值的字段，其余走 `default`。

### MessagesAnnotation 的图

```typescript
await graph.invoke({
  messages: [new HumanMessage('北京天气')]   // ← 必须是数组
})
```

`messages` 字段的 reducer 是 `addMessages`，很宽容——元素除了
`HumanMessage` 等 BaseMessage，还接受普通字符串、`{ role, content }` 对象，
会被自动转换：

```typescript
await graph.invoke({ messages: ['你好'] })                              // ✅ 字符串也行
await graph.invoke({ messages: [{ role: 'user', content: '你好' }] })    // ✅ 也行
```

### 自定义 Annotation 的图（如 ArticleState）

```typescript
await graph.invoke({ article })   // 只传 article，keywords/log 用 default
```

## 参数二：config —— 运行时配置

### 常用字段

| 字段 | 类型 | 作用 |
|---|---|---|
| `configurable` | `object` | 传给 checkpointer 的配置，**最常用是 `thread_id`**（区分会话）；还能传 `checkpoint_id` 做"时间旅行"（回放到历史某一步重跑） |
| `recursionLimit` | `number` | 最大递归/循环步数，**默认 25**。ReAct 循环每转一圈是 2 个超级步（callModel + tools），所以 `recursionLimit: 20` ≈ 最多 10 圈工具调用，超了抛 `GraphRecursionError` |
| `timeout` / `signal` | `ms` / `AbortSignal` | 超时控制，二选一（`signal` 可从外部取消） |
| `callbacks` | `Callbacks` | 挂回调（如 LangSmith tracer、自定义 handler） |

### 可观测性字段（BaseCallbackConfig 部分）

| 字段 | 作用 |
|---|---|
| `runName` | 这次调用在 tracer 里的显示名 |
| `tags` / `metadata` | 打标签/元数据，会传递给所有子调用（LLM 调用、工具调用），用于过滤追踪 |
| `runId` | 指定这次 trace 的唯一 ID（不给就自动生成 UUID） |

### 少用字段

| 字段 | 作用 |
|---|---|
| `maxConcurrency` | 并行节点（`Send` 批量分发）时的最大并发数 |

## 实际代码对照

```typescript
this.graph.invoke(
  { messages: [new HumanMessage(message)] },   // ← 参数一：State 增量
  {
    configurable:   { thread_id: threadId },   // ← 参数二：MemorySaver 靠它区分会话
    recursionLimit: 20,                       //    防 ReAct 循环失控
  }
)
```

## 两个重要细节

1. **没编译 checkpointer 时，传 `thread_id` 是无效的**——没有存档机制，
   "会话 ID"就没有意义。`thread_id` 只有配合 `compile({ checkpointer: ... })`
   才生效（这就是 simpleGraph 不传 configurable 的原因）。

2. **`recursionLimit` 计的是超级步（superstep）而不是"工具调用次数"**——
   ReAct 循环里每圈 = callModel 1 步 + tools 1 步，`20` 除以 `2` 才是
   最大的工具调用圈数。抛错时是 `GraphRecursionError`。

## 类型来源

`config` 的完整类型是 `RunnableConfig`（`@langchain/core/runnables`）：

```typescript
interface RunnableConfig {
  configurable?: Record<string, any>;
  recursionLimit?: number;   // 默认 25
  maxConcurrency?: number;
  timeout?: number;
  signal?: AbortSignal;
  // 继承自 BaseCallbackConfig：
  runName?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  callbacks?: Callbacks;
  runId?: string;
}
```
