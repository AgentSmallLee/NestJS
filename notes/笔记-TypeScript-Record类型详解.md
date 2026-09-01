# TypeScript Record 类型详解

## 是什么
`Record` 是 TypeScript 内置的**工具类型（Utility Type）**，用来定义一个**键值对对象**的类型——指定 key 的类型和 value 的类型。

```ts
Record<KeyType, ValueType>
```

## 基本用法

```ts
// key 是 string，value 是 number
const prices: Record<string, number> = {
    apple: 5,
    banana: 3,
}
```

等价于用索引签名写：
```ts
const prices: { [key: string]: number } = {
    apple: 5,
    banana: 3,
}
```

`Record` 写法更简洁、语义更清晰。

---

## 常见用法

### 1. 限定 key 为固定的几个值（最有用的场景）
```ts
type Role = 'admin' | 'user' | 'guest'

// key 只能是这三个角色之一，value 是 string
const rolePermissions: Record<Role, string[]> = {
    admin: ['create', 'read', 'update', 'delete'],
    user: ['read'],
    guest: ['read'],
}
```
- 少写了某个 key → TS 报错
- 多写了不在联合类型里的 key → TS 报错
- 非常适合**枚举 + 配置**的场景

### 2. key 是字符串，value 是任意类型
```ts
const tool_map: Record<string, any> = {
    check_product: this.checkProductTool,
    create_order: this.createOrderTool,
}
```
就是你代码里的写法：key 是任意字符串，value 是 `any`。

### 3. key 是数字
```ts
const pageData: Record<number, string[]> = {
    1: ['a', 'b'],
    2: ['c', 'd'],
}
```

### 4. value 是对象
```ts
interface User {
    name: string
    age: number
}

const users: Record<string, User> = {
    'u001': { name: '张三', age: 20 },
    'u002': { name: '李四', age: 25 },
}
```

---

## 和索引签名的对比

| 写法 | 等价写法 | 适用场景 |
|------|---------|---------|
| `Record<string, number>` | `{ [k: string]: number }` | 简单的字典类型 |
| `Record<Role, string[]>` | `{ [k in Role]: string[] }` | 限定 key 的范围（联合类型） |
| `Record<keyof T, U>` | `{ [k in keyof T]: U }` | 基于另一个类型的 key |

当 key 是**固定的联合类型**时，用 `Record` 比索引签名更直观。

---

## 实际开发中的典型场景

### 场景一：状态映射
```ts
type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed'

const statusText: Record<OrderStatus, string> = {
    pending: '待支付',
    paid: '已支付',
    shipped: '已发货',
    completed: '已完成',
}
```

### 场景二：工具映射（当前项目的 tool_map）
```ts
const tool_map: Record<string, BaseDynamicTool> = {
    check_product: this.checkProductTool,
    create_order: this.createOrderTool,
}
```

### 场景三：按分组存储数据
```ts
const productsByCategory: Record<string, Product[]> = {
    手机: [iPhone, Xiaomi],
    电脑: [MacBook, ThinkPad],
}
```

---

## 小结

| 问题 | 答案 |
|------|------|
| Record 是什么？ | TypeScript 内置工具类型，定义键值对对象 |
| 两个泛型参数分别是什么？ | 第一个 = key 的类型，第二个 = value 的类型 |
| 和索引签名的区别？ | 写法更简洁，语义更清晰，尤其适合限定 key 范围 |
| 什么时候用？ | 需要一个字典/映射表结构时 |
