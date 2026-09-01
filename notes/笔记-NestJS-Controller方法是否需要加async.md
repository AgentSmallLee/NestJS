# NestJS Controller 方法是否需要加 async

## 结论

**不需要手动加 `async`**。NestJS 的路由处理器支持直接返回 `Promise`，框架会自动 `await` 它。

## 两种等价写法

```ts
// ✅ 方式1：直接返回 Promise
@Get('xxx')
xxx() {
    return this.service.xxx()
}

// ✅ 方式2：async/await
@Get('xxx')
async xxx() {
    return this.service.xxx()
}
```

两种方式效果完全等价 —— 只要 service 方法返回的是 Promise，NestJS 都会等待它 resolve 后再响应客户端。

## 什么时候必须加 `async`

只有当方法体内**需要使用 `await`** 时才必须加 `async`，例如：

```ts
@Get('xxx')
async xxx() {
    const result = await this.service.xxx()
    // 对 result 做一些处理
    return { data: result }
}
```

## 建议

为了代码风格一致性，建议在同一个项目中统一写法 —— 要么都不加（直接 return Promise），要么都加 `async`，避免两种风格混着用。
