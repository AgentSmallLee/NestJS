# LangGraph 中 Command 与 Send 的作用

在 LangGraph 中，节点函数的返回值通常是 **state 的增量更新**（如 `return { messages: [...] }`）。
但如果想**控制图的执行流向**（动态路由、并行分发等），就需要用到 `Command` 和 `Send`。

---

## Send：发射一个独立分支

**作用**：启动一个**独立的 state 实例**去执行指定节点，是并行分发的核心。

```ts
new Send('processSubTask', { task: '子任务1' })
```

- 第一个参数：目标节点名（如 `'processSubTask'`）
- 第二个参数：传给这个分支的 state（每个分支有独立的 state 副本）
- 每 `new` 一个 `Send` = 发射一条独立的执行分支

**特点**：
- 每个 Send 实例都是**独立运行**的，互不干扰
- 每个分支有自己的 state，互不共享
- 所有分支完成后，结果通过主图 state 的 reducer 合并回来

---

## Command：控制流包装器

**作用**：节点函数的**高级返回值**，用来告诉图"接下来该怎么走"，而不只是更新 state。

```ts
return new Command({
  goto: [...],    // 路由到哪里
  update: {...},  // 同时更新 state（可选）
})
```

`goto` 支持多种形式：

| 形式 | 含义 |
|---|---|
| `'nodeName'` | 普通路由到指定节点（类似条件边） |
| `END` | 直接结束图的执行 |
| `[new Send(...), new Send(...)]` | 并行发射多个分支 |
| 混合数组 | 支持节点名和 Send 混用 |

**特点**：
- `Command` 是"**控制指令包**"，不直接更新 state
- 可以同时 `update` state + `goto` 路由
- 是动态控制流的入口

---

## 配合使用：一对多并行分发

以 `paralle.service.ts` 为例：

```ts
const splitTask = async (state: typeof ParallelState.State) => {
  // 1. 拆分子任务
  const subTasks = ['子任务1', '子任务2', '子任务3']

  // 2. 返回 Command，里面装多个 Send
  return new Command({
    goto: subTasks.map(task => new Send('processSubTask', { task })),
  })
}
```

### 执行流程

```
          ┌→ processSubTask (实例1) ─┐
splitTask ─┼→ processSubTask (实例2) ─┼→ mergeResults
          └→ processSubTask (实例3) ─┘
```

1. **splitTask** 拆分任务，返回 `Command` + 3 个 `Send`
2. LangGraph 启动 **3 个 `processSubTask` 实例**并行运行，每个有独立 state
3. 子任务返回 `{ results: [...] }`，通过主图 `results` 字段的 **reducer** 合并
4. 全部完成后汇合到 **mergeResults**，生成最终报告

### 关键点

- Send 的第二个参数（state）**必须符合子节点的 state 结构**
- 多个 Send 的结果通过**主图 state 的 reducer**合并，所以主图对应字段需要定义 reducer
- 所有分支完成后才会进入下一个节点（类似 `Promise.all`）

---

## 对比总结

| | Send | Command |
|---|---|---|
| **角色** | 单个分支的发射指令 | 控制流的包装器 |
| **作用** | "去某个节点，带这份 state" | "接下来这样走（goto/update/...）" |
| **数量** | 可以有多个（并行） | 节点每次返回一个 |
| **能否单独用** | 不能，必须放在 `Command.goto` 里 | 可以，goto 可以是节点名或 END |

---

---

## 常见疑问：为什么不能直接返回 Send？

### 问题

节点函数的返回值有两种含义：
1. **普通对象** → 被当作"state 的增量更新"，合并到 state 里，然后走正常的边
2. **Command 对象** → 被当作"控制流指令"，改变执行流程

`Send` 本身是一个指令对象，**不是 state 更新**。如果直接 `return new Send(...)`，LangGraph 会把它当成一个普通对象去合并到 state 里，而不是执行这个 Send——结果就是 state 里多了一个奇怪的字段，图也不会分叉。

### 结论（JS/TS 版）

**在 JS/TS 版 LangGraph 中，Send 不能单独返回，必须包在 `Command.goto` 里。**

```ts
// ✅ 正确：用 Command 包起来
return new Command({
  goto: [new Send('workerNode', {...}), new Send('workerNode', {...})]
})

// ❌ 错误：直接返回 Send，会被当成 state 更新
return new Send('workerNode', {...})

// ❌ 错误：直接返回 Send 数组，也会被当成 state 更新
return [new Send(...), new Send(...)]
```

---

## Python 版 vs JS/TS 版的差异

这是两个 SDK 的设计风格不同，功能等价但写法不一样。

### Python 版：可以直接返回 Send 列表

Python 版更灵活（鸭子类型风格），条件边函数和节点函数都可以**直接返回 `Send` 列表**，LangGraph 内部自动识别：

```python
# Python 版：路由函数直接返回 Send 列表，不需要 Command
def router(state):
    return [
        Send("worker_node", {"content_type": "poem"}),
        Send("worker_node", {"content_type": "joke"}),
    ]

graph.add_conditional_edges("split", router)
```

### JS/TS 版：必须用 Command 包装

JS/TS 版更显式（强类型风格），所有控制流指令统一走 `Command`，类型更清晰：

```ts
// JS/TS 版：必须包 Command
const router = (state) => {
  return new Command({
    goto: [
      new Send('workerNode', { contentType: 'poem' }),
      new Send('workerNode', { contentType: 'joke' }),
    ]
  })
}
```

### 对比表

| | Python 版 | JS/TS 版 |
|---|---|---|
| 普通条件路由 | 返回字符串节点名 | 返回字符串节点名 |
| 并行分发（条件边） | 直接返回 `list[Send]` | 返回 `new Command({ goto: Send[] })` |
| 并行分发（节点内） | 直接返回 `Send` / `list[Send]` | 返回 `new Command({ goto: Send[] })` |
| 设计风格 | 鸭子类型，隐式识别 | 强类型，显式 Command |

### 为什么两边不一样？

- **Python 版**追求简洁灵活，返回值是字符串就当路由，是 Send 列表就当并行分发
- **JS/TS 版**追求类型安全和显式表达，控制流统一走 `Command`，避免歧义

---

## 一句话总结

> **Send** 负责发射一个带独立 state 的分支；**Command** 负责包装控制指令（goto/update 等）。
> 两者配合实现"一个节点动态分发到多个并行分支"的一对多模式。
>
> **注意**：Python 版可以直接返回 Send 列表，JS/TS 版必须用 Command 包装。
