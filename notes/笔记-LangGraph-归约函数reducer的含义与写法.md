# LangGraph 归约函数（reducer）的含义与常见写法

以 `pipeline.service.ts` 为例：

```ts
progress: Annotation<string[]>({
    reducer: (prev, curr) => [...prev, ...curr],
    default: () => [],
})
```

---

## reducer 是什么意思

- **`prev`**：该字段当前累积的值
- **`curr`**：本次新写入的值
- **返回值**：作为新的累积值

`(prev, curr) => [...prev, ...curr]` 就是**数组拼接**：把新数组摊开接到旧数组后面，返回一个**新数组**（不修改旧的）。

执行过程示例（pipeline 的 progress 字段）：

```
初始:        progress = []
researcher:  写 ['✅ 素材收集完成']  → ['✅ 素材收集完成']
outliner:    写 ['✅ 大纲生成完成']  → ['✅ 素材收集完成', '✅ 大纲生成完成']
writing:     …以此类推
```

### 为什么必须有 reducer

没有 reducer 的字段（如 `topic`）用 **LastValue 通道——后写覆盖先写**，历史丢失。
`progress` 要保留所有节点的进度，所以必须声明"怎么合并新旧值"。

### 为什么用展开而不是 `push`

reducer 必须是**纯函数**——不修改 `prev`、返回新值。LangGraph 可能回放/重放状态（checkpoint、重试），副作用会破坏这一点。

---

## 不写 default 会怎样（v1.4.13 实测源码行为）

`BinaryOperatorAggregate.update()`（`dist/channels/binop.js`）的逻辑：

| 阶段 | 不写 `default` | 写了 `default: () => []` |
|---|---|---|
| 图刚启动，还没节点写入 | 读出来是 **undefined** | `[]` |
| 第一次写入 `['A']` | **reducer 不被调用**，直接 `progress = ['A']` | `reducer([], ['A'])` → `['A']` |
| 之后写入 `['B']` | `reducer(['A'], ['B'])` | 同左，结果一样 |

两个坑：

1. **第一个节点之前读取会炸**：没 default 时值是 undefined，对它 `.length`/`.map()` 直接 TypeError
2. **reducer 对"第一个值"不做变换**：第一次写入是直接赋值，如果 reducer 带加工逻辑（如 `toUpperCase`），第一批值会原样存入，行为不一致

**实践建议**：累加型字段（数组、对象、计数器）一律写 default，成本一行，换来"任何时候读都有稳定类型 + reducer 语义对所有写入一致"。

---

## 常见写法速查

### 1. 不写 reducer —— 覆盖（LastValue）

```ts
topic: Annotation<string>()   // 每次写入直接覆盖旧值
```

适合：只关心"最新值"的字段（最终结果、当前状态）。

### 2. 数组拼接（本项目用得最多）

```ts
progress: Annotation<string[]>({
    reducer: (prev, curr) => [...prev, ...curr],
    default: () => [],
})
```

适合：进度日志、结果收集（`progress`、`completedAgents`、`reviewResults`、parallel 的 `results`）。
`[...curr, ...prev]` 则是"新结果插到前面"。

### 3. 对象浅合并

```ts
config: Annotation<Record<string, any>>({
    reducer: (prev, curr) => ({ ...prev, ...curr }),
    default: () => ({}),
})
```

适合：多个节点各写一部分配置，最后合成一个对象。

### 4. 计数器 / 求和

```ts
tokenUsage: Annotation<number>({
    reducer: (prev, curr) => (prev ?? 0) + curr,
    default: () => 0,
})
```

适合：并行分支各自上报用量，最后累加。

### 5. 取最值

```ts
bestScore: Annotation<number>({
    reducer: (prev, curr) => Math.max(prev ?? -Infinity, curr),
})
```

适合：多轮自我改进（Self-RAG / Reflexion），只保留最优结果。

### 6. Map 合并

```ts
answers: Annotation<Map<string, string>>({
    reducer: (prev, curr) => new Map([...prev, ...curr]),  // 同 key 后写覆盖
    default: () => new Map(),
})
```

适合：多个分支各回答一部分问题，按 key 汇总不重复。

### 7. 带业务逻辑的自定义归约

```ts
messages: Annotation<Message[]>({
    // 只保留最近 100 条，防止上下文无限膨胀
    reducer: (prev, curr) => [...prev, ...curr].slice(-100),
    default: () => [],
})
```

reducer 是普通函数，去重、截断、排序、过滤都可以塞进去。

### 8. 特例：`MessagesAnnotation.spec.messages`

```ts
messages: MessagesAnnotation.spec.messages
```

内置的"消息专用 reducer"：拼接 + **按消息 ID 去重**（同 ID 的新消息替换旧消息而非追加），这是实现"工具调用消息修正前一条消息"的关键。

---

## 一句话总结

| 需求 | 写法 |
|---|---|
| 只要最新值 | 不写 reducer |
| 收集/累积 | `[...prev, ...curr]` |
| 各写一块、拼对象 | `{ ...prev, ...curr }` |
| 数值汇总 | `prev + curr` |
| 竞选取优 | `Math.max` 等 |
| 消息历史 | `MessagesAnnotation.spec.messages` |

**判断要不要写 reducer**：这个字段会不会被**多个节点（或并行分支）反复写**，且旧值还需要保留？
是 → 写 reducer；只写一次、后来居上 → 不写。

**并行场景尤其注意**：多个分支在同一超步（superstep）写同一字段时，reducer 会被**依次调用**合并各分支的写入
（parallel / code-review 里 `results`/`reviewResults` 能把 3 个分支结果合成一份就是这个机制）。
没写 reducer 的字段被并行分支同时写，行为只有"谁后到谁赢"，通常不是想要的。
