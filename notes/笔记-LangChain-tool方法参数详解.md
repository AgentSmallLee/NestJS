# LangChain tool() 方法参数详解

## 方法功能
`tool()` 是 `@langchain/core/tools` 提供的工具函数，用来把**普通的 JavaScript 函数**包装成 LLM 能够识别和调用的工具（Tool）。包装后，模型就可以根据用户的问题自动决定何时调用这个工具、传什么参数。

## 所在文件
`src/agents/agents.service.ts`

## 函数签名
```ts
tool(func, config)
```

接收 **2 个参数**：

| 参数位置 | 参数名 | 类型 | 必填 | 说明 |
|---------|--------|------|------|------|
| 第 1 个 | `func` | 函数 | ✅ | 工具的实际执行逻辑 |
| 第 2 个 | `config` | 对象 | ✅ | 工具的元信息配置（name、description、schema 等） |

---

## 第 1 个参数：func（工具执行函数）

### 作用
工具被调用时真正执行的业务逻辑。模型决定调用工具后，LangChain 会把模型生成的参数传进来，执行这个函数，再把返回结果传回给模型。

### 函数参数
```ts
async ({ productName }: { productName: string }) => { ... }
```
- 是一个**异步函数**（也可以是同步的，但实际工具通常涉及数据库/API 调用，用 async）
- 接收一个对象参数，属性名和类型要与 `config.schema` 中定义的字段一致
- 本例中参数是 `{ productName: string }`，对应 schema 里的 `productName: z.string()`

### 返回值
- 返回工具的执行结果（通常是字符串，模型会基于这个结果继续回答用户）
- 本例中返回商品库存/价格信息，或者商品不存在/缺货的提示

---

## 第 2 个参数：config（工具配置对象）

### 完整结构
```ts
{
    name: 'check_product',
    description: '查询商品是否有货、商品价格和库存数量...',
    schema: z.object({
        productName: z.string().describe('商品名称...'),
    }),
}
```

### 每个属性的含义

| 属性 | 类型 | 作用 | 为什么重要 |
|------|------|------|-----------|
| `name` | string | 工具的名称 | 模型通过名称识别不同工具，名称要清晰描述工具用途 |
| `description` | string | 工具的文字描述 | **最关键的属性**。模型根据这段描述决定：① 什么时候该调用这个工具 ② 什么时候不该调用。描述要写得具体，包含触发场景 |
| `schema` | Zod schema | 工具的参数定义 | 告诉模型调用时需要传什么参数、每个参数的类型和含义。模型会根据 schema 生成符合格式的参数 |

---

## 三个配置项详解

### 1. name — 工具名称
```ts
name: 'check_product'
```
- 工具的唯一标识
- 命名建议：动词 + 名词，清晰表达工具做什么
- 模型在 tool_call 中会用这个名字来指定要调用的工具

### 2. description — 工具描述
```ts
description: '查询商品是否有货、商品价格和库存数量。用户问"有没有XX"、"XX多少钱"、"XX有货吗"时调用。'
```
- **这是工具能否被正确调用的核心**
- 模型靠阅读这段描述来理解工具的用途和触发条件
- 好的 description 要包含：
  - 工具干什么用
  - 在什么场景下调用（举例）
  - 什么情况下不调用（可选）

### 3. schema — 参数 schema（Zod 格式）
```ts
schema: z.object({
    productName: z.string().describe('商品名称，例如 iPhone 16、MacBook Pro'),
})
```
- 使用 **Zod** 库定义参数结构
- `.describe()` 非常重要：给参数加文字说明，帮助模型理解每个参数该传什么值
- 模型生成的参数会被 Zod 校验，不通过的话 LangChain 会提示模型重新生成

---

## 完整示例（对应代码中的 checkProductTool）

```ts
private checkProductTool = tool(
    // ── 第 1 参数：执行函数 ──
    async ({ productName }: { productName: string }) => {
        // 查询商品数据库，返回库存/价格信息
        return `商品「${productName}」有货，单价 ¥7999，库存 50 件`
    },
    // ── 第 2 参数：配置对象 ──
    {
        name: 'check_product',                            // 工具名
        description: '查询商品是否有货、价格和库存数量',   // 工具描述
        schema: z.object({                                // 参数定义
            productName: z.string().describe('商品名称'),
        }),
    },
)
```

## 工作流程

```
用户提问："iPhone 16 多少钱？"
        │
        ▼
    LLM 接收到问题
        │
        ▼
    LLM 阅读所有工具的 description
    发现 check_product 工具匹配这个问题
        │
        ▼
    LLM 根据 schema 生成参数：{ productName: "iPhone 16" }
        │
        ▼
    LangChain 调用 tool 的 func，传入参数
        │
        ▼
    func 执行业务逻辑，返回结果字符串
        │
        ▼
    结果返回给 LLM，LLM 基于工具结果组织最终回答
```

---

## 拓展：tool() 函数式 vs @tool 装饰器

两种写法**功能完全一致**，都是把普通函数包装成 LLM 可调用的 Tool，区别只在语法风格。

### 写法对比

| | `tool()` 函数式写法 | `@tool` 装饰器写法 |
|---|---|---|
| 语法 | `tool(func, config)` | 在类方法前加 `@tool(config)` |
| 风格 | 函数式 / 命令式 | 声明式 |
| 配置位置 | 第二个参数 | 装饰器参数 |
| 适用场景 | 普通函数、类属性赋值 | 类方法 |
| 访问 `this` | 不方便（箭头函数丢失 this） | 方便（原生类方法） |

#### tool() 函数式（当前项目的写法）
```ts
private checkProductTool = tool(
    async ({ productName }) => { ... },
    {
        name: 'check_product',
        description: '查询商品库存和价格',
        schema: z.object({ productName: z.string() }),
    }
)
```

#### @tool 装饰器
```ts
import { tool } from '@langchain/core/tools';

@Injectable()
export class AgentsService {
    constructor(private prisma: PrismaService) {}

    @tool({
        name: 'check_product',
        description: '查询商品库存和价格',
        schema: z.object({ productName: z.string() }),
    })
    async checkProduct({ productName }) {
        // 可以直接访问 this.prisma、this.xxxService
        const product = await this.prisma.product.findUnique({ ... })
        return ...
    }
}
```

### 实际开发中怎么选？

| 场景 | 推荐写法 |
|------|---------|
| NestJS / 类的环境中，工具是类方法 | `@tool` 装饰器 ✅ |
| 独立的工具函数，不需要类上下文 | `tool()` 函数式 |
| 动态生成工具（循环创建一批） | `tool()` 函数式 |
| 需要访问 `this`（Prisma、其他 Service） | `@tool` 装饰器 ✅ |

### 本项目的建议
当前项目是 NestJS 架构，工具都定义在 Service 类中，后续大概率要注入 PrismaService 等依赖。**建议改用 `@tool` 装饰器写法**，更符合 NestJS 的风格，也更方便访问类的依赖。
