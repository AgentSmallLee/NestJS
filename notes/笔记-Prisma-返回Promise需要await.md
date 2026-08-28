# Prisma 操作返回值为什么不是数据对象？（Promise / await 问题）

## 现象

```ts
addUser(dto: AddUserDto) {
    const user = this.prismaService.user.create({
        data: { name: dto.name, email: dto.email, ... },
    });
    console.log(user)  // 打印出来不是用户对象，而是 Promise { <pending> }
    return { success: true, data: user };
}
```

`user` 不是预期的数据对象。

---

## 原因

**Prisma 的所有数据库操作都是异步的，返回的是 Promise，不是直接的数据对象。**

必须用 `await` 等它执行完成，才能拿到真正的数据。

---

## 正确写法

加 `async` / `await`：

```ts
async addUser(dto: AddUserDto) {      // ✅ 函数加 async
    const user = await this.prismaService.user.create({   // ✅ 调用加 await
        data: {
            name: dto.name,
            email: dto.email,
            password: dto.password,
            role: dto.role,
        },
    });
    console.log(user)   // ✅ 现在 user 是真正的数据对象
    return {
        success: true,
        data: user,
    };
}
```

---

## 对比说明

| 写法 | `user` 的类型 | 说明 |
|------|--------------|------|
| `const user = prisma.user.create(...)` | `Promise<User>` | 拿到的是一个"承诺"，数据还没回来 |
| `const user = await prisma.user.create(...)` | `User` | 等待数据库操作完成，拿到真实对象 |

---

## 需要 await 的 Prisma 方法

以下所有方法都返回 Promise，都需要 `await`：

- 查询：`findMany`、`findUnique`、`findFirst`、`count`
- 创建：`create`、`createMany`
- 更新：`update`、`updateMany`、`upsert`
- 删除：`delete`、`deleteMany`
- 聚合：`groupBy`、`aggregate`
- 事务：`$transaction`
- 连接/断开：`$connect`、`$disconnect`

---

## 常见误区

### ❌ 误区 1：return 出去就不用 await 了？

```ts
addUser(dto: AddUserDto) {
    return this.prismaService.user.create({ data: dto });
}
```

这种写法**前端能拿到正确数据**，因为 NestJS 会自动 resolve 返回的 Promise。

但如果你函数内部还要对结果做处理（`console.log`、计算、判断等），就必须 `await`。

### ❌ 误区 2：只有 create 需要 await

**所有** Prisma 数据库操作都需要，包括 `findMany`、`update`、`delete` 等等。

### ❌ 误区 3：forEach 里用 await 就没事

```ts
// ❌ 错误：forEach 不会等待异步操作
ids.forEach(async id => {
    await prisma.user.delete({ where: { id } });
});

// ✅ 正确：用 for...of 或 Promise.all
for (const id of ids) {
    await prisma.user.delete({ where: { id } });
}
```

---

## ⚠️ 重要补充：PrismaPromise 是「懒执行」的

### 核心结论

普通 JavaScript Promise 是**创建即执行**的，但 Prisma 返回的 `PrismaPromise` 不一样——它是**懒执行**的。

也就是说：
- **只有**调用 `.then()` / `.catch()` / `.finally()` 或 `await` 时，数据库操作才真正开始
- **什么都不加？操作根本不会发送到数据库！**

```ts
// ❌ 操作永远不会执行，数据库里不会有数据
const user = this.prismaService.user.create({ data: {...} });
// user 是一个 PrismaPromise，"睡着"的，没人叫醒它

// ✅ .then() 触发了执行，数据插进去了
user.then(u => console.log(u)).catch(e => console.log(e))

// ✅ await 也会触发执行（内部就是调用 .then()）
const user = await this.prismaService.user.create({ data: {...} });
```

### 执行流程图

```
prisma.user.create({...})
       ↓
  创建 PrismaPromise（还没发请求）
       ↓
       ├─ 什么都不做 → 永远不执行，数据不会插入 ❌
       ├─ .then()    → 触发执行，数据插入 ✅
       ├─ .catch()   → 触发执行，数据插入 ✅
       └─ await      → 触发执行，数据插入 ✅
```

### 为什么设计成懒的？（官方依据）

来自 `@prisma/client` 源码中的类型定义注释：

> "Creates a `PrismaPromise`. It is Prisma's implementation of `Promise` which
> is essentially a proxy for `Promise`. All the transaction-compatible client
> methods return one, **this allows for pre-preparing queries without executing
> them until `.then` is called**. It's the foundation of Prisma's query batching."

翻译：
> 「所有支持事务的客户端方法都返回 PrismaPromise，这使得查询可以**先准备好，直到调用 `.then` 时才真正执行**。这是 Prisma 查询批处理和事务的基础。」

主要用途：

**1. 支持事务 `$transaction`**
```ts
// 两个 create 先"攒着"，一起发给数据库执行
const [user, post] = await prisma.$transaction([
  prisma.user.create({ data: {...} }),   // 此时还没执行
  prisma.post.create({ data: {...} }),   // 此时还没执行
])
// 到 $transaction 这里才一起真正执行
```
如果 PrismaPromise 是创建即执行的，两个操作会各自独立执行，就没法放在同一个事务里了。

**2. 支持查询批处理 / 扩展**
Prisma 的中间件和扩展需要在查询真正发出前做处理，懒执行给了它"拦截"的机会。

### 误区 1 更新：return 出去到底会不会执行？

```ts
// 场景 A：直接 return Promise
addUser(dto: AddUserDto) {
    return this.prismaService.user.create({ data: dto });
}
```
✅ **会执行**。因为 NestJS 收到返回的 Promise 后，会调用 `.then()` 来等待结果，这就触发了执行。

```ts
// 场景 B：把 Promise 包在对象里 return
addUser(dto: AddUserDto) {
    const user = this.prismaService.user.create({ data: dto });
    return { success: true, data: user };
}
```
❌ **不会执行**。因为 NestJS 只会 resolve 最外层的返回值，不会递归 resolve 对象里嵌套的 Promise。`user` 这个 PrismaPromise 没人调用 `.then()`，所以永远不会执行。

---

## 快速验证

加一行打印看类型：

```ts
const user = this.prismaService.user.create({...});
console.log(user instanceof Promise)  // true → 说明是 Promise，需要 await
```

验证懒执行：
```ts
// 只创建，不 await
const userPromise = this.prismaService.user.create({ data: {...} });
// 等 2 秒后查数据库 → 应该没有这条数据（因为没触发执行）
// 然后加上 .then() 或 await → 再查就有了
```
