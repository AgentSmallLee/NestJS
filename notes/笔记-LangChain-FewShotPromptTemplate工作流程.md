# FewShotPromptTemplate (classify) 工作流程

## 方法功能
对输入文本进行情感分类（积极 / 消极 / 中立），使用少样本提示（Few-shot Prompting）让模型学习示例模式后输出分类结果。

## 核心组件

| 组件 | 作用 |
|------|------|
| `examples` | 少样本示例数组，每个示例包含 `text` 和 `label` |
| `examplePrompt` | 单个示例的格式化模板 |
| `prefix` | 提示词开头，说明任务规则 |
| `suffix` | 提示词结尾，放入用户实际输入并引导模型输出 |
| `inputVariables` | 用户输入的变量名列表 |

## 完整工作流程

### 1. 定义示例数据
```ts
const example = [
    { text: '今天天气很好，我们去公园玩吧', label: '积极' },
    { text: '这个老师讲课一般一般', label: '消极' },
    { text: '这个电影还行，有些地方不错', label: '中立' },
]
```

### 2. 定义单个示例的模板
```ts
const examplePrompt = PromptTemplate.fromTemplate(
    '输入「{text}输出{label}',
)
```
每个示例按照这个格式被渲染成一行文本。

### 3. 组装 FewShotPromptTemplate
```ts
const fewShotPrompt = new FewShotPromptTemplate({
    examplePrompt,
    examples: example,
    prefix: '请根据输入的文本进行情感分类，输出中立，消极或者积极',
    inputVariables: ['text'],
    suffix: '输入{text},输出',
})
```
结构：`prefix` → 全部 examples → `suffix`

### 4. 格式化生成最终 prompt
```ts
const formatPrompt = await fewShotPrompt.format({ text })
```
拼接后的完整 prompt 示例：
```
请根据输入的文本进行情感分类，输出中立，消极或者积极

输入「今天天气很好，我们去公园玩吧输出积极
输入「这个老师讲课一般一般输出消极
输入「这个电影还行，有些地方不错输出中立

输入用户的实际文本,输出
```

### 5. 调用 LLM 获取结果
```ts
const response = await this.llm.invoke(formatPrompt)
```
模型看到前面 3 个"输入...输出..."的示例，学习到模式后，在最后一行的 `输出` 后面接着输出分类标签。

## 为什么 suffix 很重要

- **没有 suffix**：prompt 结尾停在最后一个示例上，模型会误以为要继续生成更多示例，导致输出变长、跑偏
- **有 suffix**：明确告诉模型"示例结束了，现在处理这个输入并输出结果"，输出通常只有一个分类词

## 代码中的注意点

1. `suffix` 中必须包含 `inputVariables` 里声明的所有变量，否则用户输入不会出现在最终 prompt 中
2. `examplePrompt` 模板格式要和 `suffix` 的格式保持一致，这样模型才能正确识别模式
3. 当前代码 examplePrompt 模板里 `「{text}` 缺少右半边 `」`，建议补全为 `输入「{text}」输出{label}`
