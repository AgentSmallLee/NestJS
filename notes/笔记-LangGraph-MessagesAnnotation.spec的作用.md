# LangGraph 中 MessagesAnnotation.spec 的作用

`MessagesAnnotation.spec` 是 LangGraph Annotation 对象上的一个属性，用来存取 state 字段的**完整配置定义**。

---

## spec 是什么？

`spec` 是 **specification（规格/配置）** 的缩写，它是一个对象，里面存着这个 state 所有字段的**运行时配置**。

### Annotation 对象的结构

可以把 `MessagesAnnotation` 想象成一个"配置文件"：

```
MessagesAnnotation
├── .State       → TypeScript 类型（类型层面，运行时不存在）
├── .spec        → 所有字段的运行时配置（真实存在的对象）
│   └── messages → messages 字段的完整 annotation 对象
│       ├── 类型: BaseMessage[]
│       ├── reducer: (left, right) => [...left, ...right]
│       └── default: () => []
└── ... 其他内部属性
```

| 属性 | 层面 | 作用 |
|---|---|---|
| `.State` | TypeScript 类型 | 提取 state 的 TS 类型，用于类型标注 |
| `.spec` | 运行时对象 | 存储所有字段的配置（reducer、default 等） |
| `.spec.xxx` | 运行时对象 | 取某个具体字段的完整 annotation 配置 |

---

## MessagesAnnotation.spec.messages 的含义

```ts
// 从官方 MessagesAnnotation 里取出 messages 字段的完整配置
MessagesAnnotation.spec.messages
```

取出来的是 `messages` 字段的**完整 annotation 对象**，包含：

- **类型**：`BaseMessage[]`（TS 类型）
- **reducer**：消息追加函数（`(left, right) => [...left, ...right]`）
- **default**：默认值函数（`() => []`）

### 用法：复用官方配置

最常见的用法是——在自定义 state 时，直接复用官方 `messages` 字段的配置：

```ts
const MyState = Annotation.Root({
  // 复用官方 messages 字段的整套配置（类型 + reducer + default）
  // 但字段名改成自己的 message（单数）
  message: MessagesAnnotation.spec.messages,

  // 自己的其他字段
  nextAgents: Annotation<string[]>(),
})
```

### 等价于手动写

上面的写法完全等价于手动定义一遍：

```ts
import { BaseMessage } from '@langchain/core/messages'

const MyState = Annotation.Root({
  message: Annotation<BaseMessage[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  nextAgents: Annotation<string[]>(),
})
```

两种写法效果完全一样，用 `.spec.messages` 只是省得自己写一遍。

---

## 注意：字段名是自己的，配置是复用的

```ts
message: MessagesAnnotation.spec.messages,
```

这行代码里：
- **左边的 `message`** 是你自己 state 里的字段名（可以随便取，比如 `chatHistory`、`msgs`）
- **右边的 `.spec.messages`** 是从官方取来的配置（类型、reducer、default）

所以在节点函数里，你访问的是 `state.message`（你取的名字），不是 `state.messages`。

---

## 为什么需要 spec？

LangGraph 在运行时需要知道每个字段的：
- **reducer 是什么** → 节点返回值怎么合并到 state 里
- **default 是什么** → 初始值是什么

这些运行时信息都存在 `spec` 里。`StateGraph` 拿到 annotation 后，就是读 `spec` 来构建状态管理逻辑的。

---

## 对比：.State vs .spec

| | `.State` | `.spec` |
|---|---|---|
| 层面 | TypeScript 类型（纯类型） | 运行时对象（真实存在） |
| 用途 | 给函数参数/变量标注类型 | 读取字段的运行时配置 |
| 用法 | `typeof X.State` | `X.spec.字段名` |
| 例子 | `(state: typeof MessagesAnnotation.State)` | `myField: MessagesAnnotation.spec.messages` |

---

## 一句话总结

> `spec` 就是 Annotation 对象里的**字段配置清单**（运行时用的），
> `.spec.messages` 就是取出 `messages` 字段的完整配置（类型 + reducer + default），
> 可以直接赋值给自己 state 的字段，省去手动定义的麻烦。
