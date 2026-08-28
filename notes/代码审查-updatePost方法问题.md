# Post updatePost 方法审查：不标准，有多个问题

## 问题清单（按严重程度排序）

| # | 问题 | 严重程度 | 影响 |
|---|------|---------|------|
| 1 | `findUnique` 没有 `await`，`if (!post)` 判断永远不成立 | 🔴 严重 | "找不到"的判断完全失效 |
| 2 | Controller 路由是 `@Put('update')` 但用了 `@Param('id')`，id 永远拿不到 | 🔴 严重 | id 是 undefined，数据库会报错 |
| 3 | 先查再更，两次数据库查询，性能差 | 🟡 中等 | 多一次数据库往返 |
| 4 | DTO 字段都是必填的，不支持部分更新 | 🟡 中等 | 想只改 title 也要传所有字段 |
| 5 | 直接 `throw new Error`，错误处理不规范 | 🟡 中等 | 前端拿到的错误信息不友好 |
| 6 | `update` 也没有 `await`（虽然能返回结果，但不规范） | 🟢 轻微 | 代码可读性差 |

---

## 详细说明

### ❌ 问题 1：findUnique 没有 await，if 判断完全失效

```ts
// 错误代码
const post = this.prismaService.post.findUnique({ where: { id: parseInt(id) } });
if (!post) {
    throw new Error('Post not found');  // 永远不会执行！
}
```

`post` 是一个 **Promise**，Promise 永远是 truthy 值（对象），所以 `!post` 永远是 `false`，这个判断形同虚设。

即使帖子不存在，也不会进入错误分支，后面的 `update` 会自己抛错（Prisma 的 P2025 错误）。

---

### ❌ 问题 2：路由和参数不匹配，id 永远是 undefined

```ts
// Controller
@Put('update')
updatePost(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) { ... }
```

路由路径是 `'update'`（`PUT /post/update`），里面**没有** `:id` 占位符，但方法里却用了 `@Param('id')`。

结果：
- 访问 `PUT /post/update` → `id` 是 `undefined`
- `parseInt(undefined)` → `NaN`
- Prisma 报错

**正确写法：**

```ts
@Put(':id')   // 路径里要有 :id
updatePost(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) { ... }
```

或者：

```ts
@Put('update/:id')
updatePost(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) { ... }
```

---

### ⚠️ 问题 3：先查再更，多一次数据库查询

```ts
// 先查一次
const post = await prisma.post.findUnique({ where: { id } });
if (!post) throw ...

// 再更一次
return prisma.post.update({ where: { id }, data: {...} });
```

两次数据库操作，性能上是浪费的。

**更高效的做法：**直接 `update`，用 try-catch 捕获"找不到"的异常：

```ts
try {
    const post = await prisma.post.update({
        where: { id: parseInt(id) },
        data: {...},
    });
    return { success: true, data: post };
} catch (e) {
    // Prisma P2025 = 要更新的记录不存在
    if (e.code === 'P2025') {
        return { success: false, message: '帖子不存在' };
    }
    throw e;
}
```

这样只需要一次数据库操作。

> 补充：如果有业务校验（比如"只能修改自己的帖子"），那先查再更是必要的。如果只是判断存不存在，直接 update + 捕获异常更高效。

---

### ⚠️ 问题 4：DTO 字段都是必填的，不支持部分更新

```ts
export class UpdatePostDto {
    title: string;        // 都是必填
    content: string;
    published: boolean;
}
```

修改接口通常是部分更新（只想改个 title，不用传 content 和 published）。应该用可选字段：

```ts
export class UpdatePostDto {
    title?: string;
    content?: string;
    published?: boolean;
}
```

然后 service 里直接传整个 dto 给 Prisma：

```ts
data: dto,  // 传了哪些字段就更新哪些
```

---

### ⚠️ 问题 5：错误处理不规范

```ts
throw new Error('Post not found');
```

直接抛 Error 的话：
- 前端收到的是 500 错误（服务器内部错误）
- 但实际上这是 404（资源不存在）

**规范做法：用 NestJS 的异常类**

```ts
import { NotFoundException } from '@nestjs/common';

throw new NotFoundException('帖子不存在');
```

这样 NestJS 会自动返回 404 状态码，语义更准确。

---

## 完整的标准写法

### Controller

```ts
@Put(':id')
async updatePost(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
) {
    return this.postService.updatePost(id, updatePostDto);
}
```

### DTO

```ts
export class UpdatePostDto {
    title?: string;
    content?: string;
    published?: boolean;
}
```

### Service（高性能版本，一次数据库查询）

```ts
async updatePost(id: string, dto: UpdatePostDto) {
    try {
        const post = await this.prismaService.post.update({
            where: { id: parseInt(id) },
            data: dto,
        });
        return { success: true, data: post };
    } catch (e: any) {
        // Prisma P2025：记录不存在
        if (e.code === 'P2025') {
            return { success: false, message: '帖子不存在' };
        }
        throw e;
    }
}
```

### Service（先查后更版本，适合需要业务校验的场景）

```ts
async updatePost(id: string, dto: UpdatePostDto) {
    const post = await this.prismaService.post.findUnique({
        where: { id: parseInt(id) },
    });
    
    if (!post) {
        return { success: false, message: '帖子不存在' };
    }

    // 这里可以加业务校验，比如：
    // if (post.authorId !== currentUserId) throw new ForbiddenException('无权修改');

    const updated = await this.prismaService.post.update({
        where: { id: parseInt(id) },
        data: dto,
    });

    return { success: true, data: updated };
}
```

---

## 性能对比

| 方案 | 数据库查询次数 | 适用场景 |
|------|--------------|---------|
| 直接 update + try-catch | **1 次** | 只需要判断是否存在，没有其他业务校验 |
| 先 findUnique 再 update | **2 次** | 需要先查数据做业务校验（权限、状态等） |

**简单的更新场景，推荐 1 次查询的版本。**
