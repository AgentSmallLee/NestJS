# LangChain RecursiveCharacterTextSplitter 详解

## 一、为什么要用文本切分器？

在 RAG（检索增强生成）中，我们需要把文档存进向量库做语义检索，但文档往往很长（几十页 PDF、几万字文章），直接整个向量化有几个问题：

### 1. 上下文窗口限制
LLM 和 Embedding 模型都有 token 上限。一个 500 页的书不可能整个塞进去，必须切成小块。

### 2. 检索精度问题
如果整篇文章存成一个向量，检索出来的是整篇文章，里面大部分内容和问题无关，会"噪声大、答案散。切成小块后，检索到的是最相关的段落，精度更高。

### 3. 向量质量
文本越长，向量越"平均"，语义越模糊。短文本的向量表达更精准。

---

## 二、为什么选 RecursiveCharacterTextSplitter？

LangChain 提供了多种切分器，各有特点：

| 切分器 | 切分方式 | 适用场景 |
|--------|---------|---------|
| `CharacterTextSplitter` | 按固定字符切 | 简单文本 |
| **`RecursiveCharacterTextSplitter` | **递归按分隔符切** | **通用文本，推荐默认** |
| `TokenTextSplitter` | 按 token 数切 | 需要精确控制 token 数 |
| `MarkdownTextSplitter` | 按 Markdown 标题切 | Markdown 文档 |
| `PythonCodeTextSplitter` | 按代码结构切 | 代码文件 |

**`RecursiveCharacterTextSplitter` 是最常用的默认选择**，原因是：

- **智能切分，尽量保持语义完整性**：它不是硬切，而是从大的分隔符（段落 → 句子 → 词）一层层往下找合适的切点，尽量在"最自然的地方"断开，保证每个 chunk 的语义相对完整。

---

## 三、如何使用

### 基本用法

```ts
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,       // 每个 chunk 的最大字符数
    chunkOverlap: 50,       // 相邻 chunk 重叠的字符数
    separators: [          // 分隔符列表，按优先级从高到低
        '\n\n',  // 段落
        '\n',    // 行
        '。',     // 中文句号
        '！',     // 中文感叹号
        '？',     // 中文问号
        ' ',      // 空格
        '',       // 字符（最后兜底）
    ],
})

// 切分文本，返回 Document 对象数组
const docs = await splitter.createDocuments([长文本], [元数据])
```

### 常用参数说明：

| 参数 | 类型 | 说明 |
|------|------|------|
| `chunkSize` | number | 每个块的最大字符数（默认 1000） |
| `chunkOverlap` | number | 相邻块之间重叠的字符数（默认 200），防止上下文断裂 |
| `separators` | string[] | 分隔符列表，**按优先级从高到低**排列 |
| `lengthFunction` | function | 计算长度的函数，默认按字符数，可改成按 token 数 |

### 当前项目中的用法

```ts
// src/rag/rag.service.ts
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
    separators: ['\n\n', '\n', '。', '！', '？', ' ', ''],
})

const allDocuments: Document[] = []
for (const doc of documents) {
    const chunks = splitter.createDocuments([doc.content], [doc.source, doc.id])
    allDocuments.push(...chunks)
}
```

---

## 四、它是怎么切分的？（递归切分算法

`RecursiveCharacterTextSplitter` 的核心是**"递归" + "回退"**机制。

### 算法流程

1. **拿第一个分隔符（优先级最高）把文本切成大块
2. **检查每块大小是否 ≤ `chunkSize`
   - ✅ 小于等于 → 这一块就作为一个 chunk，收入结果
   - ❌ 还是太大 → **用**用下一个分隔符继续切这一块
3. **重复步骤 2，直到所有块都满足大小要求
4. **相邻的小块**重叠：每个 chunk 结尾的末尾会包含前一个 chunk 结尾的 `chunkOverlap` 个字符

### 举个例子

假设有一段长文本，`chunkSize = 100`，`separators = ['\n\n', '\n', '。', '']`：

```
第一段（150字）
...
第二段（80字）
...
第三段（200字）...
```

切分过程：

**第 1 轮：按 `\n\n`（段落）切
  → 得到三块：150字、80字、200字
  → 80字 ✅ 直接收
  → 150字、200字 ❌ 太大，继续切

**第 2 轮：按 `\n`（行）切那两块太大的
  → 150字那块切成了好几行
  → 如果某行还是太大，继续下一个分隔符

**第 3 轮：按 `。`（句号）切
  → 还是太大的句子再按句子切

**第 4 轮：按 `''`（单个字符）切
  → 最后兜底，硬切成单个字
```

### 为什么 separators 列表的**顺序很重要**：从"语义最大的单位（段落）到最小的单位（字符），保证在最自然的地方断开。

### chunkOverlap（重叠）的作用

为什么要有重叠？防止一句话被切断：

```
chunk 1: "...今天天气很好，我们
chunk 2: "我们一起去公园玩吧..."
```

如果没有重叠，"我们"这句话被切成两半，检索时可能语义不完整。有了重叠（比如重叠 50 字），两句交接处语义就连贯了。

---

## 五、中文场景的注意事项

默认的 separators 是针对英文的（`["\n\n", "\n", " ", ""]`，用空格作为词的分隔符。但**中文没有空格分词**，所以中文场景建议调整：

### 推荐的中文 separators：

```ts
separators: [
    '\n\n',           // 段落
    '\n',             // 换行
    '。',             // 句号
    '！', '？',       // 感叹号、问号
    '；',             // 分号
    '，',             // 逗号（实在不行再按逗号切
    ' ',              // 空格
    '',               // 单个字符（兜底）
]
```

当前项目已经做了中文适配，加了 `。！？`，是正确的做法。

---

## 六、chunkSize 怎么选？

没有标准答案，取决于你的场景：

| 场景 | 推荐 chunkSize |
|------|---------------|
| 问答、知识检索 | 500 ~ 1000 字符 |
| 长文档摘要 | 1000 ~ 2000 字符 |
| 代码 | 300 ~ 800 字符 |
| 只需要精确片段 | 200 ~ 500 字符 |

一般经验：
- **太小**：碎片化严重，上下文丢失，检索到的块语义不完整
- **太大**：噪声多，检索精度下降，token 成本高
- **重叠一般设为 chunkSize 的 10%~20%

当前项目设的 `chunkSize: 500, chunkOverlap: 50` 是比较合理的中文知识检索配置。
