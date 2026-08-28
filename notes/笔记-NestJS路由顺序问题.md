# NestJS 路由顺序问题（为什么 /user/query 走到了 @Get(':id')）

## 现象

访问 `GET /user/query`，结果请求走进了 `findUser` 方法，`id` 的值是 `'query'`：

```ts
@Get('list')
getUserList() { ... }

@Get(':id')              // ← 这个先匹配到了！
findUser(@Param('id') id: string) {
  console.log(id);       // 打印 'query'
}
```

---

## 原因：路由按注册顺序匹配，从上往下

NestJS（底层是 Express / Fastify）匹配路由的规则是：

**按代码里路由的书写顺序，从上往下依次匹配，谁先匹配上就用谁。**

`@Get(':id')` 里的 `:id` 是动态参数，是个**通配符**，可以匹配任何字符串。所以 `/user/query` 也能被它匹配上——只要它写在 `@Get('query')` 的上面。

```
访问 GET /user/query
       ↓
从上往下找：
  @Get()           → 不匹配（路径太短）
  @Get('list')     → 不匹配（list ≠ query）
  @Get(':id')      → ✅ 匹配上了！id = 'query'
  @Get('query')    → 不会走到这里，已经被上面的抢走了
```

---

## 解决方法：固定路径写上面，动态路径放最后

### 正确的排序原则

**越具体、越固定的路由，越往文件前面放；带参数的、动态的路由，放最后。**

```ts
// ✅ 正确顺序

// 1. 完全固定的路径
@Get('list')
@Get('query')
@Post('add')
@Post('create')

// 2. 带参数的路径（但路径前缀是固定的）
@Get('user/:id')
@Put('user/:id')
@Delete('user/:id')

// 3. 最"模糊"的动态路由放最后
@Get(':id')
@Put(':id')
@Delete(':id')
```

这样访问 `/user/query` 时，会先匹配到 `@Get('query')`，而不是被 `@Get(':id')` 抢走。

---

## 容易踩坑的场景

### 场景 1：同级下 list / query 和 :id 冲突

```ts
// ❌ 错误顺序
@Get(':id')       // 写在上面，会抢走所有请求
@Get('list')      // 永远走不到
@Get('query')     // 永远走不到

// ✅ 正确顺序
@Get('list')
@Get('query')
@Get(':id')       // 放最后
```

### 场景 2：不同 HTTP 方法之间不冲突

```ts
// ✅ 没问题，GET 和 PUT 互不影响
@Get(':id')
@Put(':id')
@Delete(':id')
```

不同 HTTP 方法是分开匹配的，不会互相抢。

### 场景 3：多级路径也是同理

```ts
// ❌ 错误
@Get(':category/:id')
@Get('posts/latest')    // 永远走不到

// ✅ 正确
@Get('posts/latest')
@Get(':category/:id')
```

---

## 一句话记牢

> **具体的写上面，模糊的写下面。**

就像 if-else 一样，严格的条件放前面，宽松的条件放后面。
