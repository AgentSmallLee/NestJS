# NestJS Controller 返回 Promise 的几种写法

> 问题：controller 里调用返回 Promise 的 service 方法，`.then` 是不是必需的？

## 三种等价的写法（以 react-chat 接口为例）

### 写法一：直接返回（最简）

```typescript
@Post('react-chat')
reactChat(@Body() body: { threadId: string; message: string }) {
  return this.reactSvc.chat(body.threadId, body.message)
}
```

- `chat` 返回 `Promise<string>`，NestJS 自动等待并序列化
- 响应体是**带引号的裸字符串**：

```json
"晴，25°C，东北风 3 级"
```

- 前端要 `JSON.parse(await res.text())` 才能拿到内容，不太方便
- 适合：service 返回值本来就是对象（`simpleChat` 等接口就是这种风格）

### 写法二：async/await + 包装（推荐）

```typescript
@Post('react-chat')
async reactChat(@Body() body: { threadId: string; message: string }) {
  const answer = await this.reactSvc.chat(body.threadId, body.message)
  return { answer }
}
```

- 响应体是对象：

```json
{ "answer": "晴，25°C，东北风 3 级" }
```

- 和 `.then` 版本产出的形状**完全一致**，只是写法换成了 await

### 写法三：`.then` 链（能用，但风格不统一）

```typescript
@Post('react-chat')
reactChat(@Body() body: { threadId: string; message: string }) {
  return this.reactSvc.chat(body.threadId, body.message)
    .then(answer => ({ answer }))
}
```

- 语义正确，能跑
- 唯一作用：**转换数据形状**（`string` → `{ answer: string }`）
- 和 controller 里其他 `return service.xxx()` 的直接返回风格不统一

## 关键认知：为什么 `.then` 是"多余但无害"的

**这三种写法对 NestJS 来说没有区别**。controller 方法返回
`Promise<xxx>`、`async` 函数、`.then` 链，NestJS 的路由适配器都会
拿到最终 resolve 的值再序列化。

- "等待 Promise"这件事是 **Nest 框架帮你做的**，不需要手动 `.then` 或 `await`
- `.then` / `await` 在这里的真正用途是**在返回前转换数据形状**

## 选择标准

选哪种取决于**想要的响应形状**，而不是技术上必须用哪种：

| 需求 | 写法 |
|---|---|
| service 返回对象，直接用 | 写法一（直接 return） |
| service 返回裸字符串，想包成 `{ answer }` | 写法二（async/await） |
| 已有的 `.then` 写法 | 写法三，无功能问题，只是风格 |

## 相关知识：async 函数为什么返回 Promise<string>

`async` 函数里 `return x` 完全等价于 `return Promise.resolve(x)`：

```typescript
async chat(...): Promise<string> {
    return result.messages.at(-1).content  // return 的是 string
    // 调用者拿到的却是 Promise<string>
}
```

- 返回类型标注描述的是**调用者拿到的东西**，不是 return 语句写的东西
- `await` 只解决**函数内部**的等待；异步结果暴露给外界只能是 Promise
- 写成 `: string` 会报 TS1064：
  `The return type of an async function or method must be the global Promise<T> type`

时间线：

```text
调用者                          async 函数内部
──────                          ─────────────
const p = chat(...)   ←─ 立刻返回 Promise<string>，函数冻结
                                   │ 后台执行 LLM + 工具循环
const answer = await p ←──────────┘ resolve 后 answer 变成 string
```

## 相关笔记

- `笔记-NestJS-Controller方法是否需要加async.md`
