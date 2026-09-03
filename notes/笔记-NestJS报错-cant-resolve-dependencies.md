# NestJS 报错：Nest can't resolve dependencies of the XXXController

## 报错场景

在 `LanggraphController` 中注入了 `ArticleService`，启动应用时直接报错：

```text
ERROR [ExceptionHandler] UnknownDependenciesException [Error]:
Nest can't resolve dependencies of the LanggraphController (LanggraphService, ?).
Please make sure that the argument ArticleService at index [1] is available
in the LanggraphModule module.

Potential solutions:
- Is LanggraphModule a valid NestJS module?
- If ArticleService is a provider, is it part of the current LanggraphModule?
- If ArticleService is exported from a separate @Module, is that module
  imported within LanggraphModule?
```

## 报错原因

**依赖注入失败**：控制器构造函数里注入了 `ArticleService`，但模块没有把它注册为 provider，NestJS 不知道去哪里创建这个实例。

问题代码（控制器注入了服务）：

```typescript
// langgraph.controller.ts
import { ArticleService } from './article.service.js';

@Controller('langgraph')
export class LanggraphController {
    constructor(
        private readonly langgraphService: LanggraphService,
        private readonly articleService: ArticleService) { }  // ← 注入了 ArticleService
}
```

但模块里漏掉了注册：

```typescript
// langgraph.module.ts —— ❌ 错误写法
@Module({
  controllers: [LanggraphController],
  providers: [LanggraphService]   // ← 缺少 ArticleService
})
export class LanggraphModule {}
```

## 解决方案

把 `ArticleService` 加进模块的 `providers`：

```typescript
// langgraph.module.ts —— ✅ 正确写法
import { ArticleService } from './article.service.js';

@Module({
  controllers: [LanggraphController],
  providers: [LanggraphService, ArticleService]
})
export class LanggraphModule {}
```

## 报错信息怎么读

```text
Nest can't resolve dependencies of the LanggraphController (LanggraphService, ?).
                          └── 哪个类注入失败                 └─┬─┘          └─┬┘
                                                            │              └── 解析失败的依赖（index [1]）
                                                            └── 括号里是构造函数的依赖列表，
                                                                ? 标记的就是找不到的那个
```

- **`(LanggraphService, ?)`**：括号里是构造函数的依赖列表，`?` 对应 `at index [1]` 的那个参数（`ArticleService`）
- **`is available in the LanggraphModule`**：告诉你在哪个模块里找——要么加到该模块的 `providers`，要么从导出它的其他模块 `imports` 进来

## 核心规则

任何被 `constructor(private readonly xxx: Xxx)` 注入的类，必须满足以下任一条件：

1. 在**当前模块**的 `providers` 数组里
2. 在**导入的模块**的 providers 里，且被那个模块 `exports` 导出

否则应用启动时就会抛出这个 `UnknownDependenciesException`。

## 另一种情况：服务在别的模块里

如果 `ArticleService` 定义在别的模块（比如 `ArticleModule`），则不能直接加 providers，而是要让 `ArticleModule` 导出它、再在当前模块导入：

```typescript
// article.module.ts
@Module({
  providers: [ArticleService],
  exports: [ArticleService],   // ← 先导出
})
export class ArticleModule {}

// langgraph.module.ts
@Module({
  imports: [ArticleModule],    // ← 再导入
  controllers: [LanggraphController],
  providers: [LanggraphService]
})
export class LanggraphModule {}
```
