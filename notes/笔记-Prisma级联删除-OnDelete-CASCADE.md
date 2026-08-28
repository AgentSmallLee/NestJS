# Prisma 级联删除是怎么实现的？（ON DELETE CASCADE）

## 一句话总结

级联删除**不是 Prisma 做的，而是 PostgreSQL 数据库本身的功能**。Prisma 只是在 schema 里声明了 `onDelete: Cascade`，然后生成对应的 SQL 迁移，最终由数据库在删除数据时自动执行。

---

## 完整流程

### 第一步：在 Prisma Schema 中声明

`prisma/schema.prisma` 里 Post 模型的 relation：

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  //                                                       ↑ 这里声明级联删除
  @@map("posts")
}
```

`onDelete: Cascade` 的意思是：**当被引用的 User 被删除时，自动删除引用它的所有 Post。**

---

### 第二步：Prisma 生成迁移 SQL

执行 `prisma migrate dev` 后，生成的迁移文件里有这一行：

```sql
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id")
  ON DELETE CASCADE   -- ← 级联删除规则
  ON UPDATE CASCADE;  -- ← 级联更新规则（id 变了也跟着变）
```

这是标准的 SQL 外键约束语法，作用是告诉 PostgreSQL：

> "posts 表里的 authorId 必须是 users 表里真实存在的 id。如果对应的 user 被删了，把这些 post 也一起删掉。"

---

### 第三步：删除用户时数据库自动处理

当你执行：

```ts
await prisma.user.delete({ where: { id: 1 } });
```

Prisma 发给数据库的 SQL 大概是：

```sql
DELETE FROM users WHERE id = 1;
```

**就这一条。** Prisma 并不会先查 post 再删 post 再删 user。

真正的级联删除是 PostgreSQL 在内部做的：
1. 收到 `DELETE FROM users WHERE id = 1`
2. 发现 `posts` 表有外键引用 `users.id`，且规则是 `ON DELETE CASCADE`
3. **自动**先删除 `posts` 中所有 `authorId = 1` 的记录
4. 再删除 `users` 中 `id = 1` 的记录

整个过程在同一个数据库事务里，要么全成功，要么全失败。

---

## onDelete 的可选值

| 值 | 行为 | 适用场景 |
|----|------|---------|
| `Cascade` | 删除主记录时，关联记录也一起删 | 文章跟着作者删、订单明细跟着订单删 |
| `SetNull` | 删除主记录时，外键字段设为 NULL | 部门解散了，员工还在，只是部门字段为空 |
| `Restrict` | 有关联记录时，禁止删除主记录 | 有订单的用户不能删，防止数据丢失 |
| `NoAction` | 类似 Restrict，但检查时机稍晚（PG 里基本一样） | 同 Restrict |
| `SetDefault` | 删除主记录时，外键设为默认值 | 较少用 |

> 注意：`SetNull` 需要外键字段是可空的（`authorId Int?`），否则会报错。

---

## Prisma 层面 vs 数据库层面

| 层面 | 做什么 |
|------|--------|
| **Prisma Schema** | 声明关系和 `onDelete` 规则（设计意图） |
| **Prisma Migrate** | 把规则翻译成 SQL 外键约束 |
| **PostgreSQL** | 真正执行级联删除，保证数据一致性 |

Prisma 的 `onDelete` 只是「声明式配置」，最终执行的是数据库的外键约束。

---

## 验证级联删除是否生效

### 方法一：看迁移 SQL

打开 `prisma/migrations/xxx/migration.sql`，搜索 `ON DELETE CASCADE`，有就说明数据库层面配置了。

### 方法二：用 psql 查表结构

```sql
\d+ posts
```

在输出里找 `Foreign-key constraints`，能看到 `posts_authorId_fkey` 和 `ON DELETE CASCADE`。

### 方法三：实际测试

```sql
-- 1. 创建一个用户
INSERT INTO users (email, name, password) VALUES ('test@test.com', '测试', '123');

-- 2. 给这个用户写两篇文章
INSERT INTO posts (title, content, "authorId") VALUES ('标题1', '内容1', 1);
INSERT INTO posts (title, content, "authorId") VALUES ('标题2', '内容2', 1);

-- 3. 删除用户
DELETE FROM users WHERE id = 1;

-- 4. 查文章 → 应该全部没了
SELECT * FROM posts WHERE "authorId" = 1;
```

---

## 常见问题

### Q: 级联删除会触发 Prisma 的中间件吗？

不会。因为级联删除是数据库直接做的，Prisma 根本不知道有哪些关联记录被删了，所以 `delete` 中间件只会对 user 触发一次，不会对每个 post 都触发。

如果你需要在删除 post 时做额外逻辑（比如清理关联文件、发通知），就不能用数据库级联，得自己在代码里先查再删。

### Q: 多层级联会怎样？

如果 A → B → C 都是 `ON DELETE CASCADE`，删除 A 时，B 和 C 都会被自动删掉。数据库会递归处理。

### Q: 性能怎么样？

数据库级联删除比「应用层先查再删」快很多，因为：
- 只发一条 SQL，不用来回传输数据
- 数据库内部优化，执行效率高
- 天然在一个事务里，保证一致性
