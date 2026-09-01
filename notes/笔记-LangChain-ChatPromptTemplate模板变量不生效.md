# ChatPromptTemplate 模板变量不生效的原因

## 问题
使用 `ChatPromptTemplate.fromMessages` 时，消息内容里的 `{variable}` 占位符没有被替换，直接原样传给了 LLM。

## 原因
`fromMessages` 支持三种输入格式，但**只有前两种支持变量插值**：

| 格式 | 示例 | 是否支持 {变量} 替换 |
|------|------|---------------------|
| 二元组（角色 + 模板字符串） | `["system", "你是{role}"]` | ✅ 支持 |
| 字符串模板 | `"Translate {text}"` | ✅ 支持 |
| 消息对象实例 | `new SystemMessage({ content: "..." })` | ❌ 当作静态消息，不做替换 |

如果传入的是 `new SystemMessage(...)` 或 `new HumanMessage(...)` 等已实例化的消息对象，`ChatPromptTemplate` 会把它们视为**静态消息**，不会扫描其中的 `{变量}` 占位符。

## 错误写法
```ts
const prompt = ChatPromptTemplate.fromMessages([
    new SystemMessage({
        content: '你是一个专业的翻译，将中文翻译成{targetLanguage}'
    }),
    new HumanMessage({
        content: "翻译内容: {text}"
    })
])
// {targetLanguage} 和 {text} 不会被替换
```

## 正确写法
使用二元组形式：
```ts
const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一个专业的翻译，将中文翻译成{targetLanguage}"],
    ["human", "翻译内容: {text}"]
])
// invoke 时变量会被正确替换
const response = await chain.invoke({ text, targetLanguage })
```

## 总结
- 需要模板变量时，用 `["角色", "模板内容"]` 二元组
- 消息对象实例只适合纯静态、不需要变量替换的场景
