# Prisma 分页查询报错：Argument `take` is missing

## 错误信息

```
PrismaClientValidationError:
Invalid `prisma.user.findMany()` invocation

Argument `take` is missing.
```

同时可能伴随 `skip: NaN`，以及 `where` 里全是 `undefined`。

---

## 原因

前端没传分页参数（`pageNum`、`pageSize`），导致：

```ts
const skip = (parseInt(query.pageNum) - 1) * parseInt(query.pageSize);
const take = parseInt(query.pageSize);
```

| 参数 | query 里的值 | `parseInt` 后 | Prisma 看到的 |
|------|-------------|--------------|--------------|
| `pageNum` | `undefined` | `NaN` | `skip: NaN` → 无效 |
| `pageSize` | `undefined` | `NaN` | `take: NaN` → Prisma 认为没传，报 "take is missing" |

`parseInt(undefined)` 返回 `NaN`，Prisma 不接受 `NaN` 作为合法的 `skip` / `take` 值。

另外，`where` 里直接写 `name: undefined` 虽然不会报错（Prisma 会忽略 undefined 值），但写法不优雅，也可能引入其他问题。

---

## 修复方法

### 完整的正确写法

```ts
async queryUser(query: QueryUserDto) {
    // 1. 分页参数加默认值
    const pageNum = parseInt(query.pageNum) || 1;      // 默认第 1 页
    const pageSize = parseInt(query.pageSize) || 10;    // 默认每页 10 条
    const skip = (pageNum - 1) * pageSize;
    const take = pageSize;

    // 2. where 条件动态组装（有值才加进去）
    const where: any = {};
    if (query.name) {
        where.name = query.name;
    }
    if (query.role) {
        where.role = query.role;
    }

    // 3. 用 $transaction 同时查列表和总数，性能更好，数据一致
    const [list, total] = await this.prismaService.$transaction([
        this.prismaService.user.findMany({
            where,
            skip,
            take,
            orderBy: { id: 'desc' },
        }),
        this.prismaService.user.count({ where }),
    ]);

    return {
        total,
        list,
        pageNum,
        pageSize,
    };
}
```

---

## 三个关键点

### 1. 用 `||` 处理 NaN，给默认值

```ts
const pageNum = parseInt(query.pageNum) || 1;
```

原理：
- `parseInt(undefined)` → `NaN`
- `NaN || 1` → `1`（因为 NaN 是 falsy 值，`||` 会返回右边的值）

常用默认值：
- `pageNum` 默认 `1`
- `pageSize` 默认 `10`（或 20，看业务）

### 2. where 条件动态组装

❌ 不好的写法（字段值为 undefined 也塞进去）：
```ts
where: {
    name: query.name,     // undefined
    role: query.role,     // undefined
}
```

✅ 好的写法（有值才加）：
```ts
const where: any = {};
if (query.name) where.name = query.name;
if (query.role) where.role = query.role;
```

好处：
- 生成的 SQL 更干净
- 不会出现一堆无效条件
- 扩展新的筛选条件很方便

### 3. 用 `$transaction` 同时查列表和总数

❌ 分开两次查询（慢，且数据可能不一致）：
```ts
const list = await prisma.user.findMany({...});
const total = await prisma.user.count({...});
```

✅ 用事务一起查（快，数据一致）：
```ts
const [list, total] = await prisma.$transaction([
    prisma.user.findMany({...}),
    prisma.user.count({...}),
]);
```

好处：
- 只发起一次数据库"会话"，性能更好
- 列表和总数是同一时间点的数据，不会中间有新增导致对不上

---

## 扩展：更优雅的 where 组装（模糊查询）

如果 `name` 是模糊匹配，用 `contains`：

```ts
const where: any = {};
if (query.name) {
    where.name = {
        contains: query.name,   // 模糊匹配：包含这个字符串
        mode: 'insensitive',    // 可选：忽略大小写
    };
}
```

生成的 SQL 大概是：`WHERE name LIKE '%xxx%'`

---

## 常见报错对照

| 报错 | 原因 | 解决 |
|------|------|------|
| `Argument 'take' is missing` | `take` 是 `NaN` 或 `undefined` | 加默认值 `parseInt(pageSize) \|\| 10` |
| `Argument 'skip' is missing` | `skip` 是 `NaN` 或 `undefined` | 加默认值 `pageNum` 默认为 1 |
| `Unknown arg 'xxx' in where` | `where` 里传了不存在的字段 | 检查字段名是否和 schema 一致 |
| `Value types mismatch` | 字段类型不匹配（比如传了字符串给数字字段） | 做类型转换 |
