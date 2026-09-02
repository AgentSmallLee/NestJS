# JavaScript 扩展运算符 `...` 的作用

## 简短回答

`...` 是 **扩展运算符（Spread Operator）**，作用是把一个数组**展开**成一个个独立的元素。

---

## 基本用法

```ts
const arr1 = [1, 2, 3]
const arr2 = [...arr1, 4, 5] // [1, 2, 3, 4, 5]
//             ↑
//        把 arr1 展开成 1, 2, 3
```

相当于把数组的"壳"去掉，里面的元素一个个摊开。

---

## 在 `push(...chunks)` 中的作用

```ts
allDocuments.push(...chunks)
```

### 如果不加 `...`

```ts
allDocuments.push(chunks)
// chunks 整个数组作为一个元素被 push 进去
// 结果：allDocuments = [doc1, doc2, [chunk1, chunk2, chunk3]]
//                                        ↑ 整个数组成了一个元素（嵌套了）
```

`push` 接收的参数是一个个元素，如果直接传 `chunks`（数组），它会把整个数组当作**一个元素**塞进去，导致数组嵌套。

### 加了 `...` 之后

```ts
allDocuments.push(...chunks)
// 等价于：
allDocuments.push(chunk1, chunk2, chunk3, ...)
// 结果：allDocuments = [doc1, doc2, chunk1, chunk2, chunk3]
//                                        ↑ 每个 chunk 都是独立元素
```

`...chunks` 把数组展开成一个个独立的参数传给 `push`，每个 chunk 都作为独立元素被添加。

---

## 等价写法对比

以下几种写法效果一样：

```ts
// 1. 扩展运算符（最简洁，推荐）
allDocuments.push(...chunks)

// 2. concat（返回新数组，不修改原数组）
allDocuments = allDocuments.concat(chunks)

// 3. 手动循环
for (const chunk of chunks) {
    allDocuments.push(chunk)
}

// 4. apply（老写法，不推荐）
allDocuments.push.apply(allDocuments, chunks)
```

---

## `...` 的其他常见用途

### 1. 数组合并

```ts
const merged = [...arr1, ...arr2, ...arr3]
```

### 2. 数组拷贝（浅拷贝）

```ts
const copy = [...original]
```

### 3. 对象展开

```ts
const user = { name: 'Tom', age: 20 }
const updated = { ...user, age: 21 } // { name: 'Tom', age: 21 }
```

### 4. 函数参数（剩余参数，Rest Parameters）

注意：同样是 `...`，放在函数参数里叫**剩余运算符**，作用相反 —— 把多个参数收集成一个数组：

```ts
function sum(...nums) {
    // nums 是一个数组，包含所有传入的参数
    return nums.reduce((a, b) => a + b, 0)
}

sum(1, 2, 3, 4) // 10
```

---

## 总结：Spread vs Rest

| 用法 | 名称 | 作用 |
|------|------|------|
| `push(...arr)` | 扩展运算符（Spread） | 数组 → 展开成多个元素 |
| `function fn(...args)` | 剩余参数（Rest） | 多个元素 → 收集成数组 |

简单记：**在赋值/传参的右边（值的位置）是展开，左边（接收的位置）是收集。**
