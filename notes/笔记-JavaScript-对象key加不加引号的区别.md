# JavaScript 对象 key 加不加引号的区别

## 结论
**加不加引号都一样，本质都是字符串。** 符合标识符命名规则的 key，引号可以省略，这是 JS 的语法糖。

```js
// 两种写法完全等价
{ check_product: value }
{ "check_product": value }
```

## 什么时候必须加引号？

当 key 不符合**标识符命名规则**时，必须用引号包裹：

| 情况 | 示例 | 是否必须加引号 |
|------|------|--------------|
| 普通字母/数字/下划线/`$` | `check_product`、`userName`、`_private` | 可加可不加 |
| 包含空格 | `"user name"` | ✅ 必须加 |
| 包含横杠或特殊符号 | `"user-name"`、`"user@name"` | ✅ 必须加 |
| 以数字开头 | `"123abc"` | ✅ 必须加 |
| 中文 key | `"商品名称"` | ✅ 必须加 |
| JS 关键字/保留字 | `"class"`、`"function"` | 建议加（严格模式下不加会报错） |

## 为什么 tool_map 的 key 不用加引号？

```ts
const tool_map: Record<string, any> = {
    check_product: this.checkProductTool,
    create_order: this.createOrderTool,
}
```

- `check_product`、`create_order` 这些 key 都只包含**字母和下划线**，完全符合标识符命名规则
- 所以引号可以省略，写起来更简洁

## Record<string, any> 是什么？

这是 TypeScript 的类型注解：

- `Record` = 记录/字典类型（键值对集合）
- `<string, any>` = key 是 `string` 类型，value 是 `any` 类型

它表示这个对象的所有 key 都是字符串，所有 value 可以是任意类型。这也印证了——对象的 key 本来就是字符串。

## 访问时的对应写法

| 对象定义 | 点访问（`.`） | 方括号访问（`[]`） |
|---------|--------------|-------------------|
| `{ name: "a" }` | `obj.name` ✅ | `obj["name"]` ✅ |
| `{ "user name": "a" }` | ❌ 语法错误 | `obj["user name"]` ✅ |
| `{ "123": "a" }` | ❌ 语法错误 | `obj["123"]` ✅ |

- key 符合标识符规则：两种访问方式都可以
- key 不符合标识符规则：只能用方括号访问

## 总结

1. JS 对象的 key 本质上都是字符串（Symbol 除外）
2. 符合标识符规则的 key，引号可以省略，这是语法糖
3. 包含空格、特殊符号、以数字开头、中文等 key，必须加引号
4. 加不加引号运行时没有任何区别，只是写法不同
