# Prisma 报错：Database "mac" does not exist

## 错误信息

```
ERROR [ExceptionsHandler] PrismaClientKnownRequestError:
Invalid `this.prismaService.post.create()` invocation
Database `mac` does not exist on the database server

code: 'P1003',
cause: {
  originalCode: '3D000',
  originalMessage: 'database "mac" does not exist',
  kind: 'DatabaseDoesNotExist',
  db: 'mac'
}
```

---

## 原因

`.env` 里的 `DATABASE_URL` 明明写的是 `nest_demo`，但运行时却在找 `mac` 数据库，原因是：

**NestJS 应用运行时没有加载 `.env` 文件**，导致 `process.env.DATABASE_URL` 是 `undefined`。

`pg` 的 `Pool` 拿到空的 `connectionString` 后，使用了默认规则——连接与当前系统用户名同名的数据库（macOS 用户名是 `mac`），所以变成了找 `mac` 数据库。

---

## 为什么 Prisma CLI 没问题？

`prisma7.config.ts` 顶部已经写了 `import 'dotenv/config'`，但**这个文件只在 Prisma CLI 执行时才会加载**（比如 `prisma migrate dev`、`prisma generate`）。

NestJS 应用启动时并不会执行 `prisma7.config.ts`，所以应用运行时拿不到 `.env` 里的变量。

---

## 解决方法

### 第一步：安装 dotenv（如果还没装）

```bash
pnpm add dotenv
```

### 第二步：在应用入口加载 .env

在 `src/main.ts` 的**最顶部**引入：

```ts
import 'dotenv/config'  // 加载 .env 文件，让 process.env.DATABASE_URL 等生效
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
```

### 第三步：重启服务

```bash
npm run start:dev
```

---

## 关键点

- `prisma7.config.ts` 里的 `dotenv/config` → 只给 **Prisma CLI** 用
- `main.ts` 里的 `dotenv/config` → 给 **NestJS 应用运行时** 用
- 两个地方都需要，各司其职

---

## 验证方法

在 `PrismaService` 的 `constructor` 里加一行打印，确认变量是否加载成功：

```ts
constructor() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL)  // 调试用
  // ...
}
```

如果打印 `undefined`，说明 `.env` 没加载成功；
如果能看到完整的连接串，说明没问题。
