# LangGraph pipeline：单 agent 能实现吗，为什么要拆多节点

以 `pipeline.service.ts`（researcher → outliner → writing → review）为例。

一句话结论：**一个 agent（甚至一次 LLM 调用）完全可以实现同样的功能**，拆多节点换来的是可控性、可观测性和小模型下的质量。

---

## 单 agent 版本长什么样

```ts
const createContent = async (topic: string) => {
    const res = await llm.invoke([
        new HumanMessage(`你是专业编辑，为主题"${topic}"写一篇文章：
1. 先收集素材（背景、要点、案例）
2. 拟大纲（3-5 章）
3. 按大纲写 400-600 字正文
4. 最后润色定稿
直接输出最终文章。`),
    ])
    return res.content
}
```

能跑，产出也能看。区别在于：**单 agent 是让模型"在脑子里"完成全部步骤，
pipeline 是强迫它"把每一步的中间结果写下来"再进入下一步**。

---

## 拆多节点的收益

### 1. 对本地小模型最关键：输出上限

模型是 `qwen3.5:0.8b`（numPredict 512 / 上下文窗口有限）。单 agent 要**一次**生成
"素材+大纲+正文+润色"的完整链路，输出容易超长被截断，或模型"忘记"前面的设定。
拆开后每个节点只干一小段活，每步输出量小、注意力集中——**模型越弱，拆分带来的质量提升越明显**。

### 2. 中间结果可见、可调试

`progress` 能看到卡在哪一步；`research`/`outline`/`draft` 每个中间产物都能单独检查。
单 agent 里素材收集错了，只能看到最终文章不对，很难定位是"没素材"还是"写得差"。

### 3. 上下文可控

每个节点的 prompt 只带它需要的东西（outliner 只看 research，不需要看其他）。
单 agent 的 mega-prompt 会越来越长，指令互相干扰，0.8b 的模型尤其扛不住。

### 4. 结构带来的扩展性

想在大纲后加人工确认（interrupt）、把 writing 和 review 换成不同强度的模型、
把 research 换成真搜索工具——pipeline 里都是改一条边/换一个节点的事；
单 agent 里就是重写整个 prompt。

---

## 代价（诚实说）

- **慢**：4 次串行 LLM 调用 vs 1 次
- **误差传导**：素材跑偏，后面大纲、正文全歪（garbage in, garbage out），
  单 agent 反而能边写边自我纠正
- **不是所有任务都值得**：写个 200 字短文拆 4 步纯属自虐

---

## 更准确的认知：这不算"多 agent"

pipeline.service.ts 的 4 个节点是**同一个 LLM + 4 个不同 prompt 的工序拆分**，
本质是 **workflow（工作流）而不是 multi-agent**。
真正的多 agent 强调：不同的模型/工具配置、乃至自主决策（supervisor 那种由 LLM 决定下一步）。

业界实用的判断口径（来自 Anthropic 的 building effective agents）：

> **能预先写死步骤顺序的，用 workflow（pipeline / routing / parallel）；
> 顺序不确定、要模型自己决定的，才用 agent / multi-agent（supervisor / react-agent）。**

所以这个文件的意图是演示"如何用 State 把固定流程串起来"，
而不是"为什么需要多个智能体"。

---

## 一句话总结

> 单 agent 是"一个聪明人从头干到尾"，pipeline 是"流水线每个工位只干一件事"。
> 模型越弱、任务越长、越需要看到中间过程，拆分越划算；
> 任务越简单、越在意延迟，单次调用越好。
