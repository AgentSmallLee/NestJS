# LangGraph 中 SubState（Send 入参）与主图状态的关系

在并行分发的场景中，经常会看到主图定义一个 State，子节点又定义一个 SubState。
两者的关系容易混淆，这里梳理清楚。

---

## 核心结论

> **SubState 是 Send 传给节点的入参类型（临时的、独立的），不是主图状态的"私有状态"或子集。
> 入参形状可以和主图完全不同，只有节点的返回值才需要对齐主图 state 的字段。**

---

## 两者的定位

以 `paralle.service.ts` 为例：

```ts
// 主图 state：整个图共享的全局状态
const ParallelState = Annotation.Root({
    task: Annotation<string>(),
    results: Annotation<{ task: string, result: string }[]>({
        reducer: (prev, curr) => [...prev, ...curr],
        default: () => [],
    }),
    finalReport: Annotation<string>(),
})

// 子节点的入参 state：只约束 Send 传过来的形状
const SubState = Annotation.Root({
    task: Annotation<string>(),
})
```

| | ParallelState（主图状态） | SubState（入参类型） |
|---|---|---|
| **作用** | 整个图的全局共享状态 | Send 传给子节点的入参形状 |
| **生命周期** | 贯穿整张图的执行 | 只在 Send → 节点这一跳有效 |
| **字段来源** | 初始 invoke 传入 + 各节点更新 | Send 的第二个参数 |
| **返回值对齐** | — | 节点返回值要合并回主图状态 |

---

## 数据流：SubState 是怎么来、怎么去的？

```
ParallelState (主图状态)
{
  task: "请研究AI的发展历史",
  results: [],
  finalReport: ""
}
     │
     │ Send('processSubTask', { task: '子任务1：AI起源' })
     ▼
┌───────────────────────────────────────┐
│ processSubTask 节点拿到的 state        │
│ { task: '子任务1：AI起源' }  ← SubState│
│ （只有 task，没有 results、finalReport）│
└───────────────────────────────────────┘
     │
     │ return { results: [{ task, result }] }
     ▼
回到 ParallelState，通过 results 的 reducer 合并
{
  task: "请研究AI的发展历史",
  results: [{ task: '子任务1：AI起源', result: '...' }],
  finalReport: ""
}
```

### 关键步骤

1. **Send 发出去的 state**（SubState 形状）和主图状态**是两回事**——Send 的第二个参数可以是任意对象
2. **节点拿到的 state** 就是 Send 传的那个对象，类型用 SubState 约束
3. **节点返回的结果**会合并回**主图 state**（ParallelState），所以返回值的字段必须和主图对应

---

## 常见误解澄清

### ❌ 误解 1：SubState 的属性必须包含在主图状态里

**不对。** SubState 只是入参类型，Send 可以传任何东西给目标节点，不需要和主图状态有关系。

举个反例：主图 state 里根本没有 `task` 字段，也照样可以 Send 一个带 `task` 的对象：

```ts
// 主图 state 没有 task 字段
const MainState = Annotation.Root({
  results: Annotation<string[]>({ reducer: ... }),
})

// 子节点入参完全自定义
const SubState = Annotation.Root({
  task: Annotation<string>(),   // 主图里根本没有这个字段，也可以
  priority: Annotation<number>(),  // 随便加
})
```

### ❌ 误解 2：SubState 是"子图状态"，有自己的生命周期

**不对。** SubState 不是一个独立的状态机，它只是**一次函数调用的入参类型**。
节点执行完后，入参就消失了，只有返回值会影响主图状态。

### ✅ 正确理解：SubState 是类型层面的约束

SubState 本质上是为了**类型安全和代码可读性**：

- 如果 `processSubTask` 的参数直接写 `typeof ParallelState.State`，类型上它能拿到 `results`、`finalReport` 等字段，但运行时 Send 只传了 `task`，**类型和运行时不一致**
- 定义 SubState 明确告诉 TS 和读者："这个节点被调用时，state 里只有 task 字段"

---

## 为什么需要两个 State 定义？

### 只有一个 ParallelState 会怎样？

```ts
// 如果 processSubTask 直接用 ParallelState 类型
const processSubTask = async (state: typeof ParallelState.State) => {
  // 类型上说 state.results 存在
  // 但运行时 Send 只传了 { task: '...' }，results 根本没有
  console.log(state.results)  // 类型上不报错，运行时是 undefined
}
```

结果就是**类型欺骗**——TS 以为有，实际没有。

### 用 SubState 的好处

```ts
// SubState 准确描述了节点实际拿到的东西
const processSubTask = async (state: typeof SubState.State) => {
  console.log(state.task)     // ✅ 有，类型和运行时一致
  console.log(state.results)  // ❌ TS 直接报错，字段不存在
}
```

类型准确，代码意图清晰。

---

## 一句话总结

> **主图 State 是全局共享状态（贯穿全图），SubState 是 Send 的入参类型（单次调用的输入）。
> 入参可以随便定义，返回值才需要对齐主图。SubState 存在的意义是让类型和运行时保持一致。**
