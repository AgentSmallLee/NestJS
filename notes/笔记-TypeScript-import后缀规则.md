# TypeScript import 路径后缀规则（.js 写还是不写？）

## 核心结论

**取决于模块系统：CommonJS 可以省略，ESM（nodenext/node16）必须写 `.js`。**

---

## 两种情况对比

### 1. CommonJS 模式 —— 可以省略后缀

```ts
import { PrismaClient } from '../generated/prisma/client'     // ✅ 没问题
```

**触发条件（满足其一即可）：**
- `tsconfig.json` 中 `"module": "commonjs"` / `"es2020"` 等
- `tsconfig.json` 中 `"moduleResolution": "node"`（旧版）
- `package.json` 中没有 `"type": "module"`

---

### 2. ESM 模式 —— 必须写 `.js` 后缀

```ts
import { PrismaClient } from '../generated/prisma/client.js'  // ✅ 正确
import { PrismaClient } from '../generated/prisma/client'     // ❌ 报错
```

> ⚠️ 注意：哪怕源文件是 `.ts`，import 路径里也要写 `.js`。
> 这是 TypeScript 的 ESM 规则——编译器不会帮你自动补后缀。

**触发条件（同时满足）：**
- `package.json` 中有 `"type": "module"`
- `tsconfig.json` 中 `"module": "nodenext"` 或 `"node16"`
- `tsconfig.json` 中 `"moduleResolution": "nodenext"` 或 `"node16"`

---

## 本项目配置检查

| 配置文件 | 配置项 | 值 | 结论 |
|----------|--------|-----|------|
| `package.json` | `type` | `"module"` | ESM 模式 |
| `tsconfig.json` | `module` | `"nodenext"` | ESM 模块 |
| `tsconfig.json` | `moduleResolution` | `"nodenext"` | ESM 解析 |

**结论：本项目所有相对路径 import 都必须带 `.js` 后缀。**

---

## 验证方法

看 Prisma 生成的代码，它内部的 import 也都带了 `.js`：

```ts
// src/generated/prisma/client.ts
import * as $Enums from "./enums.js"
import * as $Class from "./internal/class.js"
import * as Prisma from "./internal/prismaNamespace.js"
```

---

## 常见误区

❌ **错误认知**：源文件是 `.ts`，所以 import 路径应该写 `.ts`
✅ **正确**：永远写 `.js`（即使源文件是 `.ts`），因为编译后运行的是 `.js` 文件

❌ **错误认知**：第三方包也要加后缀
✅ **正确**：只有**相对路径**（以 `.` 或 `..` 开头）的 import 才需要加后缀，第三方包（如 `@prisma/client`）不需要

---

## 速查表

| import 路径示例 | 是否需要加 `.js` |
|-----------------|-----------------|
| `./utils` | ✅ 需要 → `./utils.js` |
| `../services/user` | ✅ 需要 → `../services/user.js` |
| `@prisma/client` | ❌ 不需要 |
| `react` | ❌ 不需要 |
| `node:fs` | ❌ 不需要 |
