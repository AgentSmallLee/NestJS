# codeReview 方法工作流程

## 方法功能
对用户输入的代码进行审查，指出代码中的错误和改进建议。支持指定编程语言（通过 `language` 参数动态调整 system prompt）。

## 涉及文件
- `src/prompts/prompts.service.ts` — 业务逻辑
- `src/prompts/prompts.controller.ts` — 接口入口：`POST /prompts/code-review`

## 完整工作流程

### 1. 接收参数
```ts
async codeReview(code: string, language: string)
```
- `code`：待审查的代码内容
- `language`：编程语言（如 JavaScript、TypeScript、Python 等），影响 system prompt 的角色设定

### 2. 构建对话模板
```ts
const prompt = ChatPromptTemplate.fromMessages([
    ['system', '你是一个专业的{language}代码审查员，你的任务是审查用户输入的代码,并输出审查结果'],
    ['human', "请审查以下的{language}代码，并指出错误和改进:\n{code}"]
])
```
使用 `ChatPromptTemplate.fromMessages` 的二元组形式，支持 `{变量}` 插值。

- **system 消息**：设定 LLM 的角色——专业的 {language} 代码审查员
- **human 消息**：给出具体任务和待审查的代码

### 3. 组装链式调用（LCEL）
```ts
const chain = prompt.pipe(this.llm)
    .pipe(new StringOutputParser())
```
管道顺序：
1. `prompt` — 将输入变量填充到模板中，生成完整的消息列表
2. `this.llm` — 调用 Ollama 大模型生成回复
3. `StringOutputParser` — 解析模型输出，只取纯文本内容（去掉消息对象包装）

### 4. 执行调用
```ts
const response = await chain.invoke({ code, language })
```
传入 `code` 和 `language` 两个变量，触发整条链的执行。

### 5. 返回结果
```ts
return {
    origin: code,
    codeReview: response
}
```
- `origin`：原始代码
- `codeReview`：模型给出的审查结果（纯文本）

## 关键要点

1. **动态角色设定**：通过 `{language}` 变量，同一个方法可以审查不同语言的代码
2. **LCEL 管道式写法**：`prompt.pipe(llm).pipe(parser)` 是 LangChain Expression Language 的标准写法，清晰且支持流式调用
3. **StringOutputParser**：把 `AIMessage` 对象解析成字符串，省去手动取 `.content` 的步骤
4. **Ollama 配置**：`this.llm` 在类顶部初始化，复用同一个 LLM 实例（含模型、温度、baseUrl 等配置）
