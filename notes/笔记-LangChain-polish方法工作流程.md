# polish 方法工作流程

## 方法功能
对输入的文章进行**两阶段润色**：先分析文章存在的问题，再根据分析结果对文章进行优化润色。使用 `RunnableSequence` 将两条链串联起来，形成一个多步工作流。

## 涉及文件
- `src/chains/chains.service.ts` — 业务逻辑
- `src/chains/chains.controller.ts` — 接口入口：`POST /chains/polish`

## 完整工作流程

### 整体结构：两阶段串行
```
用户输入 article
     │
     ▼
┌─────────────────┐
│  analyzeChain   │  第一步：分析文章问题，输出问题列表
└────────┬────────┘
         │ analysis（分析结果）
         ▼
┌─────────────────┐
│  polishChain    │  第二步：根据分析结果润色文章
└────────┬────────┘
         ▼
    最终润色结果
```

---

### 第一步：analyzeChain（分析文章问题）

**模板定义：**
```ts
const analyzePrompt = ChatPromptTemplate.fromMessages([
    ['system', '你是一个文章分析助手，只输出问题列表，不要其他问题'],
    ['human', "分析这篇文章存在的问题:\n{article}"]
])
```
- system 角色：文章分析助手，限制输出格式（只输出问题列表）
- human 消息：传入待分析的文章 `{article}`

**链定义：**
```ts
const analyzeChain = analyzePrompt.pipe(this.llm)
    .pipe(new StringOutputParser())
```
- `analyzePrompt` → 填充模板
- `this.llm` → 调用 LLM 生成问题列表
- `StringOutputParser` → 解析为纯文本

输出：一段纯文本的问题列表，赋值给 `analysis`。

---

### 第二步：polishPrompt（根据分析结果润色）

**模板定义：**
```ts
const polishPrompt = ChatPromptTemplate.fromMessages([
    ['system', '你是一个文章润色助手，根据输出的文章列表对文章进行润色'],
    ['human', "根据以下分析结果{analysis},优化这篇文章:\n{article}"]
])
```
- 需要两个输入变量：`analysis`（第一步的输出）和 `article`（原始文章）

---

### 串联：RunnableSequence + RunnablePassthrough

```ts
const fullChain = RunnableSequence.from([
    { article: new RunnablePassthrough(), analysis: analyzeChain },
    polishPrompt.pipe(this.llm).pipe(new StringOutputParser())
])
```

**第一行（对象分发器）：**
- `article: new RunnablePassthrough()` — 把输入的 `article` 原样透传下去
- `analysis: analyzeChain` — 用 `analyzeChain` 处理输入，得到分析结果

这一步把输入 `{ article }` 转换成 `{ article, analysis }`，为第二步准备好两个变量。

**第二行：**
- 用 `polishPrompt` 接收 `{ article, analysis }` → 调用 LLM → 输出解析为字符串

---

### 执行与返回
```ts
const response = await fullChain.invoke({ article })
return {
    origin: article,
    polish: response
}
```
- `origin`：原始文章
- `polish`：最终润色后的文章

## 关键概念

### RunnableSequence
LangChain 的串行执行器，调用方式为 `RunnableSequence.from([步骤1, 步骤2, ...])`。

**参数说明：**
- 接收**一个数组**参数，数组中每个元素代表工作流中的一个步骤
- 步骤按顺序执行，**上一步的输出 = 下一步的输入**

**支持的步骤类型：**

| 类型 | 说明 | 示例 |
|------|------|------|
| 另一条链 | prompt、llm、parser 或它们的 pipe 组合 | `analyzeChain` |
| 对象（值为 Runnable） | 并行分发输入，每个值同时处理，最终合并为对象输出 | `{ a: pass, b: chain }` |
| 普通函数 | 自动包装为 Runnable | `(input) => input.toUpperCase()` |
| RunnablePassthrough | 原样透传输入 | `new RunnablePassthrough()` |

**对象分发步骤的工作原理（以本方法为例）：**
```ts
{ article: new RunnablePassthrough(), analysis: analyzeChain }
```
- 输入：`{ article: "用户文章" }` 同时分发给两个值
- `article` → `RunnablePassthrough()` 透传 → 输出 `"用户文章"`
- `analysis` → `analyzeChain` 处理 → 输出 `"问题列表..."`
- 合并输出：`{ article: "用户文章", analysis: "问题列表..." }`

**数据流：**
```
invoke({ article })
      │
      ▼
┌──────────────────────────────┐
│  { article: pass,            │  ← 第 1 步：并行分发
│     analysis: analyzeChain } │
└──────────────┬───────────────┘
               │
               ▼  { article, analysis }
┌──────────────────────────────┐
│  polishPrompt.pipe(llm)      │  ← 第 2 步：润色
│               .pipe(parser)  │
└──────────────┬───────────────┘
               ▼
        最终润色结果
```

### RunnablePassthrough
"透传"操作——把输入原封不动地传下去。这里用来在多步链中保留原始数据（`article`），确保下游步骤还能访问到。

### 对象分发器中两个属性的类型对比

```ts
{ 
  article: new RunnablePassthrough(),   // 属性1：透传 Runnable
  analysis: analyzeChain                // 属性2：处理链 Runnable
}
```

| 属性 | 类型 | 是什么 | 作用 |
|------|------|--------|------|
| `article` | `RunnablePassthrough` | Runnable 的子类（透传器） | 把输入原样输出，保留原始数据 |
| `analysis` | `RunnableSequence`（LCEL 链） | Runnable 的子类（串行链） | 处理输入，生成新的分析结果 |

**共同点：** 两者都是 `Runnable` 基类的子类，LangChain 中所有可运行单元（prompt、llm、chain、passthrough 等）都继承自 `Runnable`。

**为什么第一个要用 RunnablePassthrough？**

因为第二步 `polishPrompt` 需要两个输入变量：`{article}` 和 `{analysis}`。但原始输入只有 `{ article }`，如果只跑 `analyzeChain`，输出就只有 `analysis`，原始的 `article` 就丢失了。

`RunnablePassthrough` 的作用就是**保留原始输入**，让它和处理结果一起传给下一步。

**类比流水线：**
```
原料：面粉
   │
   ▼
┌─────────────────────────┐
│ 保留面粉 → 面粉         │  ← RunnablePassthrough：原样保留
│ 加工面粉 → 面包         │  ← analyzeChain：加工成新东西
└──────────┬──────────────┘
           ▼
     { 面粉, 面包 }
           │
           ▼
        包装工序            ← 同时需要面粉（配料）和面包（主料）
```

### 对象分发器的规则总结

1. 对象里的**每个属性值都必须是 Runnable**（链、passthrough、函数等均可）
2. 对象作为一个整体是"**并行分发器**"：输入同时发给所有属性值，各自独立执行
3. 执行完毕后，各属性的输出被合并为一个新对象，传给下一步
4. 属性名就是输出对象的 key，属性的输出就是对应 value

### 为什么不直接用一条链？
两阶段的好处：
1. **先诊断再优化**：让模型先思考问题所在，再针对性修改，润色质量更高
2. **职责分离**：分析和润色各有各的 system prompt，角色更清晰
3. **可复用**：analyzeChain 可以单独被其他方法复用

### 常见疑问：article 和 analysis 能不能分成两个对象？

**不能。必须放在同一个对象里。**

#### 分成两个对象的错误写法
```ts
RunnableSequence.from([
    { article: new RunnablePassthrough() },   // 第1步：只有 article
    { analysis: analyzeChain },               // 第2步：只有 analysis
    polishPrompt.pipe(this.llm)...            // 第3步：需要 article + analysis
])
```

#### 错误原因
`RunnableSequence` 是串行的，每一步的输出完全覆盖下一步的输入。第2步输出只有 `analysis`，第1步的 `article` 就丢失了。

数据流：
```
输入 { article }
     │
     ▼
第1步 { article: "..." }            ✅ 只有 article
     │
     ▼
第2步 { analysis: "问题列表" }       ❌ article 丢失了！
     │
     ▼
第3步 polishPrompt 需要 { article, analysis } → 报错
```

#### 同一个对象的正确写法
```ts
{ article: new RunnablePassthrough(), analysis: analyzeChain }
```
同一个对象中的多个属性是**并行执行**的，同时接收同一个输入，各自处理后合并输出，两个数据都能保留。

数据流：
```
输入 { article }
     │
     ├────→ article: passthrough ────→ "用户文章"
     │                                  (并行，同时执行)
     └────→ analysis: analyzeChain ───→ "问题列表"
                                        │
                                        ▼
                    合并输出 { article: "用户文章", analysis: "问题列表" }
```

#### 什么时候可以分开写？
当工作流是**纯串行**的，每一步只需要上一步的输出，不需要更早的数据时，可以分开写：

```ts
// 每步只依赖上一步的结果，纯流水线
RunnableSequence.from([
    translateChain,    // 中文 → 英文
    summarizeChain,    // 英文文章 → 英文摘要
    formatChain        // 摘要 → 格式化
])
```

#### 对比总结

| 写法 | 执行方式 | 输出 | 适用场景 |
|------|---------|------|---------|
| 同一对象多个属性 | **并行**，同一输入同时处理 | 合并为一个对象，所有属性都保留 | 需要同时保留原始数据 + 新生成数据 |
| 多个对象（多个步骤） | **串行**，上一步输出 = 下一步输入 | 每步只有一个输出对象 | 纯流水线处理，每步只依赖上一步 |

## 注意点

1. `polishPrompt` 的 human 消息中 `{analysis}` 前后没有换行，建议加上 `\n` 让格式更清晰，减少模型混淆
2. `numPredict: 100` 限制了输出 token 数，对于长文章润色可能不够，可考虑调大
