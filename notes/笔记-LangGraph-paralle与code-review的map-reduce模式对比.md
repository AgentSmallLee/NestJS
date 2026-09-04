# LangGraph paralle 与 code-review：同一种 map-reduce 工作流程

一句话结论：**两个服务是同一种工作流程（map-reduce 并行模式）的两份实例化，严格来说都不是多 Agent**。

---

## 图结构对比

```
paralle.service.ts                          code-review.service.ts
─────────────────────────                   ─────────────────────────
START → splitTask                           START → dispatch
          │ Command+Send 发射3个分支                    │ Command+Send 发射3个分支
          ├→ processSubTask(实例1)                 ├→ reviewAgent(实例1, 安全性)
          ├→ processSubTask(实例2)                 ├→ reviewAgent(实例2, 性能)
          └→ processSubTask(实例3)                 └→ reviewAgent(实例3, 代码规范)
                     │ 汇合（reducer 合并）                  │ 汇合（reducer 合并）
          → mergeResults → END                  → generateReport → END
```

每个环节一一对应：

| 环节 | paralle | code-review |
|---|---|---|
| 分发方式 | `new Command({ goto: sends })` | 同左 |
| 分支节点 | `processSubTask` 多实例 | `reviewAgent` 多实例 |
| 子状态 | `SubState`（只带 task） | `SingleReviewState`（带 aspect/prompt） |
| 结果回收 | `results` 字段 + reducer | `reviewResults` 字段 + reducer |
| 汇合点 | `mergeResults`（边写死） | `generateReport`（边写死） |

这就是经典的 **map-reduce 模式**：任务拆成 N 份（map）→ 并行处理 → reducer 收集（reduce）→ 汇总生成最终结果。

---

## 仅有的两处实质差异

### 1. 分工是动态的还是写死的（最值得注意）

```ts
// paralle：让 LLM 现场决定拆成哪 3 个子任务（动态）
const res = await llm.invoke([「把任务拆成 3 个子任务…」])
subTasks = res.content.split('\n')

// code-review：三个审查维度硬编码在代码里（静态）
const tasks = [
  { aspect: '安全性',   prompt: '…' },
  { aspect: '性能',     prompt: '…' },
  { aspect: '代码规范', prompt: '…' },
]
```

- paralle 的拆分质量取决于 LLM（0.8b 模型可能拆得不均匀甚至拆不出 3 条）
- code-review 的维度固定，**不依赖模型自觉**——工程上可控性高得多，灵活性则是 paralle 高

### 2. 汇总节点的确定性部分

code-review 的 `generateReport` 里算平均分是**纯代码**（`reduce` 求和取整），LLM 只负责写报告文本
——**确定性计算和生成式输出分离**，这是好实践。paralle 的 mergeResults 完全交给 LLM。

---

## 都是多 Agent 吗？

**严格来说都不是**。所有节点跑的是**同一个 LLM**，所谓"多个 agent"只是同一模型的不同 prompt 实例：
没有自主决策（谁都不决定下一步走哪，图是写死的），也没有不同的工具配置。
属于 **workflow 里的并行分支（map-reduce）模式**。

LangGraph 章节的三层结构（自由度递增）：

| 模式 | 自由度 | 例子 |
|---|---|---|
| **顺序 workflow** | 步骤全写死 | pipeline |
| **并行 workflow（map-reduce）** | 步骤写死，N 个实例同时跑 | paralle、code-review |
| **多 agent（supervisor）** | LLM 动态决定调谁、循环到完成 | supervisor、react-agent |

共同点：都靠 State + reducer 收集结果。
分界线始终是**"流向是谁决定的"**——代码写死的都是 workflow，模型决定的才是 agent。

---

## 一句话总结

> paralle 和 code-review 是同一张图的两个填法：一个把"拆什么"交给 LLM（动态），
> 一个把"审什么"写死在代码里（静态）。它们和 pipeline 一样是 workflow，
> 只有 supervisor 那种"模型自己决定下一步"的才算真正的多 agent。
