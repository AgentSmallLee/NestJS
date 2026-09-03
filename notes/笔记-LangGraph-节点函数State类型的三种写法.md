# LangGraph 节点函数 State 类型的三种写法

在 LangGraph 中，节点函数的 `state` 参数类型不一定要写 `typeof MessagesAnnotation.State`，有多种写法可选，功能等价。

---

## 写法一：从内置 Annotation 推断类型（最省事）

```ts
import { MessagesAnnotation } from '@langchain/langgraph'

const callModel = async (state: typeof MessagesAnnotation.State) => {
  // state.messages 类型自动推导出 BaseMessage[]
  const response = await llmWithTools.invoke(state.messages)
  return { messages: [response] }
}
```

**特点**：
- 直接复用 `MessagesAnnotation` 已经定义好的类型
- 不需要自己写 interface/type
- 适合 state 只有 `messages` 的简单场景

---

## 写法二：自己定义接口（完全等价）

```ts
import { BaseMessage } from '@langchain/core/messages'

interface AgentState {
  messages: BaseMessage[]
}

const callModel = async (state: AgentState) => {
  const response = await llmWithTools.invoke(state.messages)
  return { messages: [response] }
}

// 建图时仍然可以用 MessagesAnnotation
const graph = new StateGraph(MessagesAnnotation)
  .addNode('callModel', callModel)
  // ...
```

**特点**：
- 类型手写，结构清晰
- 只要字段结构和 `MessagesAnnotation.State` 一致，TS 就不会报错
- 适合想显式掌控类型定义的场景

---

## 写法三：自定义 Annotation（最推荐，扩展性最好）

如果 state 不止有 `messages`，或者需要自定义 reducer / 默认值，用 `Annotation.Root` 定义自己的 state：

```ts
import { Annotation, StateGraph } from '@langchain/langgraph'
import { BaseMessage } from '@langchain/core/messages'

// 定义自己的 State Annotation
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: (left, right) => [...left, ...right],
  }),
  userId: Annotation<string>,          // 额外字段
  context: Annotation<Record<string, any>>({  // 额外字段 + 默认值
    default: () => ({}),
  }),
})

// 节点函数用 typeof 取类型
const callModel = async (state: typeof StateAnnotation.State) => {
  // state.messages, state.userId, state.context 都有类型
  const response = await llmWithTools.invoke(state.messages)
  return { messages: [response] }
}

// 建图时也用自定义的 Annotation
const graph = new StateGraph(StateAnnotation)
  .addNode('callModel', callModel)
  // ...
```

**特点**：
- 类型定义和运行时的 annotation 是**同一个来源**，不会出现"类型写了但运行时没这个字段"的不一致问题
- 支持自定义 `reducer`、`default` 等高级特性
- 扩展性最好，加字段只改一处
- 中大型项目推荐写法

---

## 对比总结

| 写法 | 适用场景 | 优点 | 缺点 |
|---|---|---|---|
| `typeof MessagesAnnotation.State` | state 只有 messages，图很简单 | 代码最少，开箱即用 | 扩展性差 |
| 手写 interface / type | state 结构简单且固定 | 直观，完全可控 | 容易和实际 annotation 不同步 |
| 自定义 `Annotation.Root` + typeof | state 多字段 / 需要 reducer | 类型和运行时一致，扩展性强 | 代码稍多 |

---

## 核心结论

节点函数的 state 类型**怎么写都行**，只要类型结构和创建 `StateGraph` 时传的 annotation 对得上就没问题。

`typeof MessagesAnnotation.State` 本质上就是**从 annotation 对象反向提取 TypeScript 类型**，避免手写重复定义，是一种"偷懒"但实用的写法。

---

## 补充：为什么是 `MessagesAnnotation.State` 而不是 `MessagesAnnotation.messages`？

这是一个很容易混淆的点，关键在于理解 `MessagesAnnotation` 的"双重身份"：

### `MessagesAnnotation` 本身是一个 StateGraph Annotation（运行时对象）

`MessagesAnnotation` 不是一个简单的"包含 messages 的对象"，它是 `Annotation.Root` 的产物，代表**整个 state 的定义**。它的结构大致是：

```ts
// MessagesAnnotation 的内部形态（简化理解）
const MessagesAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: ...,
    default: () => [],
  })
})
```

所以：
- `MessagesAnnotation` → 整个 state 的 annotation 对象（传给 `new StateGraph(...)` 的那个）
- `MessagesAnnotation.State` → 从整个 state 推导出的 **TypeScript 类型**（即 `{ messages: BaseMessage[] }`）
- `MessagesAnnotation.spec.messages` → `messages` 字段的 annotation 定义（含 reducer、default 等运行时信息）

### 为什么不能写 `typeof MessagesAnnotation.messages`？

因为 `MessagesAnnotation` 上**没有直接的 `messages` 属性**。`messages` 是 state 里的字段名，它的定义藏在 `MessagesAnnotation.spec.messages` 里（spec 是内部结构，一般不直接用）。

而 `.State` 是 LangGraph 在 Annotation 对象上挂的一个**类型属性**（TypeScript 的 type-only 属性），专门用来取整个 state 的类型：

```ts
// typeof MessagesAnnotation.State 等价于：
{
  messages: BaseMessage[]
}
```

### 一句话总结

> `MessagesAnnotation` 是**整个 state 的运行时定义**，`.State` 是从它身上提取出的**整个 state 的 TypeScript 类型**。我们给节点函数参数标注的是"整个 state 的类型"，所以写 `typeof MessagesAnnotation.State`，而不是去取某个字段。
