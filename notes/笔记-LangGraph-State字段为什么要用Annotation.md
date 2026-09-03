# LangGraph State 字段为什么要用 Annotation 包裹

## 核心结论

State 定义里写的不是"类型"，而是**运行时的 channel 对象**。
因为 TS 类型编译后会被完全擦除，LangGraph 运行时需要的信息（合并规则、默认值）
必须用真正的 JS 值来携带——`Annotation(...)` 这个函数调用就是把这些信息
"物化"成 channel 对象。

## Annotation 其实是一个函数调用

看编译产物（`@langchain/langgraph/dist/graph/annotation.js`）：

```javascript
const Annotation = function(annotation) {
    if (annotation) return getChannel(annotation);  // 有 reducer → BinaryOperatorAggregate
    else return new LastValue();                    // 没参数 → LastValue（覆盖语义）
};

function getChannel(reducer) {
    if (reducer && reducer.reducer)
        return new BinaryOperatorAggregate(reducer.reducer, reducer.default);
    return new LastValue();
}
```

对照实际代码：

```typescript
const ArticleState = Annotation.Root({
    article:  Annotation<string>(),                       // 运行时 = new LastValue()
    keywords: Annotation<string[]>({ reducer, default }), // 运行时 = BinaryOperatorAggregate 实例
})
```

所以 `Annotation.Root({...})` 拿到的 spec 实际是：

```javascript
{
    article:  LastValue 实例,          // 覆盖语义
    keywords: BinaryOperatorAggregate, // 追加语义（跑你写的 reducer）
}
```

**每个字段都是一个 channel 实例**——这才是 StateGraph 真正消费的东西。
LangGraph 构建图时遍历 spec，为每个字段创建 channel；每次节点返回增量时，
调用 channel 的更新方法把新值合并进 State：

- `LastValue`：直接覆盖
- `BinaryOperatorAggregate`：拿旧值和新值跑 reducer

## 为什么不能直接写 `article: string`

假设允许这样写：

```typescript
const ArticleState = Annotation.Root({
    article: string,        // ❌ 假设的语法
    keywords: string[],
})
```

TS 类型标注编译后 **100% 被擦除**，上面的代码编译到 JS 就是：

```javascript
const ArticleState = Annotation.Root({ })   // 类型没了！
```

LangGraph 运行时就完全不知道：字段叫什么、`keywords` 该追加还是覆盖、默认值是什么。
所以 State 里凡是运行时需要的行为信息（合并规则、默认值），都必须以真实 JS 值的形式
存在——`Annotation(...)` 调用就是把这些信息物化成 channel 对象。

## 类型和运行时是怎么串起来的

`Annotation` 有双重身份——通过泛型把类型挂到 channel 上：

```typescript
// @langchain/langgraph/dist/graph/annotation.d.ts
interface AnnotationFunction {
  <ValueType, UpdateType = ValueType>(annotation: SingleReducer<ValueType, UpdateType>)
    : BaseChannel<ValueType, ...>;        // ← reducer 泛型 → channel 的 ValueType
  <ValueType>(): LastValue<ValueType>;    // ← 裸调用 → LastValue<ValueType>
}

// 提取逻辑：
type ExtractValueType<C> = C extends BaseChannel ? C["ValueType"] : ...
```

整条链路：

```text
Annotation<string[]>({ reducer })     ← 自己写的定义
        ↓ 运行时
BinaryOperatorAggregate 实例          ← StateGraph 用它合并状态
        ↓ 类型层（编译期）
BaseChannel<string[], ...>
        ↓ ExtractValueType 条件提取
typeof ArticleState.State.keywords → string[]   ← 节点函数里的类型提示
```

## 这是 JS 生态的通用模式

"用运行时值承载类型"在 TS 生态随处可见，本质都一样——类型会被擦除，
需要运行时行为的元数据只能用值来表达：

| 库 | 运行时值 | 承载的元数据 |
|---|---|---|
| LangGraph | `Annotation<T>()` → channel | 字段合并规则、默认值 |
| Zod | `z.string()` → schema | 校验规则 |
| class-validator | `@IsString()` 装饰器 | 校验规则 |

## 一句话总结

State 定义里用 `Annotation` 是因为每个字段在运行时必须是一个 channel 对象
（携带 reducer/默认值），否则类型擦除后 LangGraph 什么都不知道；同时
`Annotation<T>` 的泛型又把类型记录在 channel 上，让 `typeof X.State` 能反推出
类型提示——**一次调用，同时服务运行时和编译期**。
