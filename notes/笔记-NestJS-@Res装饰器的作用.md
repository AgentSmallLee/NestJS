# NestJS @Res() 装饰器的作用

## 作用

`@Res()` 是 NestJS 提供的参数装饰器，用于将**底层平台的响应对象**（如 Express 的 `Response`）注入到路由处理方法中。

## 为什么要用

在 NestJS 的标准模式中，路由处理器只需要返回数据，NestJS 会自动：
- 序列化返回值为 JSON
- 设置合适的状态码和响应头
- 发送响应给客户端

但有些场景下，你需要**手动控制响应**，这时就需要 `@Res()`：

### 常见使用场景

1. **流式响应（SSE / 流式输出）** —— 需要逐步往响应流里写数据
   ```ts
   @Post('chat-stream')
   chatStream(@Body() body: { ... }, @Res() res: Response) {
       res.setHeader('Content-Type', 'text/event-stream')
       res.write('data: hello\n\n')
       // ... 持续写入
   }
   ```

2. **文件下载** —— 需要设置特定的响应头并 pipe 文件流
   ```ts
   @Get('download')
   download(@Res() res: Response) {
       res.download('/path/to/file')
   }
   ```

3. **自定义状态码 / 响应头** —— 需要精细控制 HTTP 响应
   ```ts
   @Get('custom')
   custom(@Res() res: Response) {
       res.status(201).header('X-Custom', 'value').json({ ok: true })
   }
   ```

4. **重定向**
   ```ts
   @Get('redirect')
   redirect(@Res() res: Response) {
       res.redirect('/other-url')
   }
   ```

## ⚠️ 重要注意事项

**注入 `@Res()` 后，NestJS 会跳过自动响应处理**。这意味着：

- 方法的 `return` 值**不会**被自动序列化为响应
- 你必须手动调用 `res.send()` / `res.json()` / `res.end()` / `res.write()` 等来发送响应
- 如果忘记发送响应，请求会**挂起超时**

```ts
// ❌ 错误：return 的值不会被发送
@Get('demo')
demo(@Res() res: Response) {
    return { message: 'hello' } // 无效！客户端收不到响应
}

// ✅ 正确：手动发送响应
@Get('demo')
demo(@Res() res: Response) {
    res.json({ message: 'hello' })
}
```

## 如果你既要 @Res() 又想保留 NestJS 自动处理

可以使用 `passthrough` 选项：

```ts
@Get('demo')
demo(@Res({ passthrough: true }) res: Response) {
    res.setHeader('X-Custom', 'value')  // 手动设置响应头
    return { message: 'hello' }          // 返回值仍由 NestJS 自动序列化
}
```

`passthrough: true` 表示：我用 `@Res()` 只是想**读取/修改**响应对象（设置 cookie、header 等），但响应体还是交给 NestJS 来处理。

## 当前项目中的用法

在 `MemoryController.chatStream` 中：

```ts
@Post('chat-stream')
chatStream(@Body() body: { sessionId: string; message: string }, @Res() res: Response) {
  return this.memoryService.chatStream(body.sessionId, body.message, res)
}
```

这里使用 `@Res()` 是因为 `chatStream` 需要做**流式响应**（SSE 或 chunked 输出），需要手动往响应流里持续写入数据，而不是一次性返回完整 JSON。
