# LangGraph 中 routing 与 supervisor 工作流程的区别

以本项目 `routing.service.ts` 和 `supervisor.service.ts` 为例，两种图都用"LLM 决策 + 条件边"做路由，但模式完全不同。

一句话区别：**routing 是"一次性分流"，走一条路就结束；supervisor 是"循环调度"，多次决策、多个 worker 协作完成一个任务**。

---

## 工作流程图

### routing：分类分发（单次决策）

```
START → classify（LLM 分类）→ 条件边选一个 → handler → END
```

- LLM 只在开头做**一次**分类决策，输出 `technical | pricing | general`
- 三个 handler 只是**不同的提示词模板**（`makeHandler` 工厂函数），本质是同一个 LLM 换角色
- 选中一个 handler 执行完就到 END，**节点之间没有任何交互**——technical 不会用 pricing 的结果，因为每个分支只走一个
- 状态是"传纸条"式的：`classify` 写 `category`，handler 写 `response`，一次穿过图

### supervisor：协调者循环（多轮决策）

```
START → supervisor ─┬→ researcher ─┐
        ↑            ├→ analyst ────┤（都回到 supervisor）
        └────────────┴→ writer ────┘
                  supervisor 判断完成 → END
```

- supervisor 是一个**有状态的协调者**：每轮看到 `completedAgents` 和累积的 `messages`，反复决策"下一步叫谁"
- worker 的产出写进共享 `messages`，**后续节点能看到前面的成果**——writer 写报告时用的就是 researcher/analyst 的输出（worker 里取最近 4 条消息做上下文）
- 循环执行直到 supervisor 输出 `FINISH`，一个任务可能串联 3+ 次 LLM 调用

---

## 关键差异表

| 维度 | routing | supervisor |
|---|---|---|
| LLM 决策次数 | 1 次（开头分类） | N 次（每轮循环一次） |
| 图结构 | DAG，一条路到 END | 带环的图，worker → supervisor 回边 |
| 节点间信息流 | 无（各分支互不相见） | 有（共享 messages 累积） |
| 适合的任务 | 一个问题，一个答案 | 需要多个步骤合成的任务 |
| 风险 | 分错类就答错 | 死循环（靠 `recursionLimit: 30` 兜底） |

---

## 都算多智能体协作吗？

- **supervisor 是**：经典的 Supervisor / Orchestrator-Workers 多智能体模式——有一个"大脑"负责规划调度，多个角色各干各的活，成果汇总合成最终结果。
- **routing 严格来说不算**：它更像"智能路由 + 专业化应答"。虽然有三个"角色"，但它们是**互斥的备选项**（OR 关系），不是协作关系（AND 关系）。

判断标准：**一次请求里到底有几个 agent 参与产出？** routing 是 1 个（外加 1 次分类），supervisor 是多个。

---

## 一个直观的类比

- routing = **客服总机转接**——转到一个坐席，事就办完了
- supervisor = **项目经理**——拆解任务、依次派给不同专家、收回成果、判断还缺什么、最后汇总交差

本项目 LangGraph 章节的演进顺序（routing → parallel → supervisor）也正是从"分支"到"并行"再到"协作"的难度递进。
