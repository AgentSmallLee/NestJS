# LangGraph 自定义 State 的方法

## 三种定义 State 的方式

### 1. 内置的 `MessagesAnnotation`

```typescript
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph'

const graph = new StateGraph(MessagesAnnotation)
    .addNode('callModel', callModel)
    ...
```

`MessagesAnnotation` 是官方预定义的 State，等价于：

```typescript
const MessagesAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        // reducer：追加而不是覆盖，这就是"只返回新增消息，历史不丢"的原因
        reducer: (prev, curr) => [...prev, ...curr],
        default: () => [],
    }),
})
```

只有一个 `messages` 字段，reducer 是**追加**语义。节点里 `return { messages: [response] }`
而历史不丢，就是 reducer 在起作用。

### 2. `Annotation.Root` 自定义 State（推荐写法）

```typescript
import { StateGraph, START, END, Annotation } from '@langchain/langgraph'

const ArticleState = Annotation.Root({
    // 写法一：普通字段 —— 每次节点返回值直接「覆盖」旧值
    article: Annotation<string>(),

    // 写法二：带 reducer —— 节点返回时按自定义规则「合并」旧值和新值
    keywords: Annotation<string[]>({
        reducer: (prev, curr) => [...prev, ...curr],  // 追加
        default: () => [],                            // 初始值
    }),

    summary: Annotation<string>(),

    log: Annotation<string[]>({
        reducer: (prev, curr) => [...prev, ...curr],
        default: () => [],
    }),
})

const graph = new StateGraph(ArticleState)
    .addNode('extractKeywords', async (state: typeof ArticleState.State) => { ... })
    ...
```

关键点：

- **`Annotation<T>()`**：定义一个字段。State 里每个节点都能读；节点返回的对象就是要写入的增量。
- **`reducer`**：决定"节点返回的值怎么和 State 里已有的值合并"。不写 reducer 就是**整体覆盖**（最后一次写入生效）；写了就是自定义合并逻辑（追加、求和、去重……）。
- **`default`**：State 初始值，invoke 时不传这个字段就用它。
- **读取类型**：`typeof ArticleState.State` 拿到整个 State 的 TS 类型（用于节点参数的类型标注）。

### 3. 手动 Channels（老写法，了解即可）

```typescript
const graph = new StateGraph({
    channels: {
        keywords: { reducer: (a: string[], b: string[]) => [...a, ...b], default: () => [] },
        summary: { value: null, default: () => '' },
    },
})
```

`Annotation.Root` 本质上就是这套底层 channel 语法的封装，新代码没必要用手动写法。

## reducer 的两种典型语义对比

| 语义 | 写法 | 效果 |
|---|---|---|
| **覆盖**（Last Value） | `Annotation<string>()` | 节点返回什么，State 里就是什么 |
| **追加**（Append） | `reducer: (p, c) => [...p, ...c]` | 多次/多个节点写入的值都保留 |

追加语义最重要的用途是**并行分支**：两个节点并行写同一个字段时，
覆盖语义会互相踩掉，追加语义则都能保留。

## 节点的读写规则

```typescript
const node = async (state: typeof ArticleState.State) => {
    // 读：state.article、state.keywords、state.log 全部可读（reducer 合并后的最新值）

    // 写：只返回要更新的字段，不需要返回整个 State
    return {
        keywords: ['NestJS', 'LangGraph'],   // ← 增量，会和已有值走 reducer 合并
        log: ['关键词提取完成'],
    }
}
```

invoke 时传入初始 State：

```typescript
const result = await this.graph.invoke({ article })   // 只传 article，keywords/log 用 default
```

## 注意事项

`Annotation<string>()` 没有 `default` 时，invoke **必须传**这个字段，否则运行时是
`undefined`（TS 层面不报错——类型推断为必填，但运行时不校验）。
如果希望字段可选，写成：

```typescript
Annotation<string | undefined>({ default: () => undefined })
```
