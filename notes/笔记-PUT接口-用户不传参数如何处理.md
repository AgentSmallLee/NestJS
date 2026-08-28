# PUT / PATCH 接口，用户不传参数时如何处理？

## 先明确一个概念：PUT 传空 body ≠ 不传参数

实际开发中，"用户没传参数"有几种不同的情况，处理方式也不一样：

| 场景 | 含义 | HTTP 状态码 |
|------|------|------------|
| body 完全没传 / 是个空对象 | 用户什么都不想改？ | 400 Bad Request |
| 传了部分字段（只传 name，不传 password） | 只想改部分字段 | 200 OK（正常更新） |
| 传了字段但值是 undefined | 和没传一样 | 按跳过处理 |

下面分别说。

---

## 一、部分更新是常态，应该支持

真实项目里，修改用户信息基本都是**部分更新**（想改名字就只传 name，想改密码就只传 password），不会每次都把所有字段传一遍。

所以 DTO 的字段应该设计成**可选**的：

```ts
// modify-user.dto.ts
export class ModifyUserDto {
    name?: string;      // ? 表示可选
    password?: string;  // ? 表示可选
}
```

然后 Service 里直接把 DTO 整个传给 Prisma：

```ts
async modifyUser(id: string, dto: ModifyUserDto) {
    const user = await this.prismaService.user.update({
        where: { id: parseInt(id) },
        data: dto,  // ✅ 直接传整个对象，传了哪些字段就更新哪些
    });
    return { success: true, data: user };
}
```

Prisma 的 `update` 很聪明：传了的字段就更新，没传的字段保持不变。

---

## 二、如果 body 是空对象（一个字段都没传）

### 方案 A：直接拒绝（推荐，简单明了）

告诉前端"你啥都不传，我更新个啥？"

```ts
async modifyUser(id: string, dto: ModifyUserDto) {
    // 如果一个有效字段都没有，直接报错
    if (Object.keys(dto).length === 0) {
        return { success: false, message: '至少传入一个要修改的字段' };
    }

    const user = await this.prismaService.user.update({
        where: { id: parseInt(id) },
        data: dto,
    });
    return { success: true, data: user };
}
```

### 方案 B：静默成功（不推荐）

啥都不传也返回成功，假装更新了。但这样前端可能以为自己改成功了，其实啥都没改。

```ts
async modifyUser(id: string, dto: ModifyUserDto) {
    if (Object.keys(dto).length === 0) {
        const user = await this.prismaService.user.findUnique({ where: { id: parseInt(id) } });
        return { success: true, data: user };
    }
    // ... 正常更新
}
```

---

## 三、用 NestJS 管道做参数校验（更优雅）

上面的手动判断可以，但每个接口都写一遍很麻烦。NestJS 推荐用 `ValidationPipe` + `class-validator` 做自动校验。

### 第一步：装包

```bash
pnpm add class-validator class-transformer
```

### 第二步：在 main.ts 启用全局校验

```ts
import { ValidationPipe } from '@nestjs/common';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  
  // ✅ 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,           // 自动剔除 DTO 里没定义的字段（防注入）
    forbidNonWhitelisted: true, // 传了多余字段直接报错
    transform: true,           // 自动把 plain object 转成 DTO 类实例
  }));

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
```

### 第三步：给 DTO 加装饰器

```ts
// modify-user.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ModifyUserDto {
    @IsOptional()          // 可选：不传就跳过校验
    @IsString()            // 传了的话必须是字符串
    @MinLength(1)          // 传了的话长度至少 1
    name?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;
}
```

这样，传了不合规的值会自动返回 400 错误，不用自己写判断。

---

## 四、关于 PUT vs PATCH

顺带提一下 HTTP 方法的语义：

| 方法 | 语义 | 适用场景 |
|------|------|---------|
| `PUT` | 完整替换（用请求体的内容完全替换资源） | 传所有字段，整体更新 |
| `PATCH` | 部分更新（只改请求体里传了的字段） | 只传要改的字段 |

真实项目里，很多团队为了简单，不管 PUT 还是 PATCH 都按"部分更新"来做，这也没问题。但严格来说，部分更新用 `PATCH` 更符合 REST 语义。

---

## 五、完整的最佳实践代码

```ts
// modify-user.dto.ts
import { IsOptional, IsString, MinLength, IsEmail } from 'class-validator';

export class ModifyUserDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    name?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @IsOptional()
    @IsEmail()
    email?: string;
}
```

```ts
// user.service.ts
async modifyUser(id: string, dto: ModifyUserDto) {
    // 校验：至少传一个字段
    if (Object.keys(dto).length === 0) {
        throw new Error('至少传入一个要修改的字段');
    }

    const user = await this.prismaService.user.update({
        where: { id: parseInt(id) },
        data: dto,
    });

    return { success: true, data: user };
}
```

```ts
// main.ts（启用全局校验管道）
app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
}));
```

---

## 总结

1. **DTO 字段设为可选**（加 `?`），支持部分更新
2. **直接把 DTO 传给 Prisma**，传了啥就更啥
3. **空对象检测**：一个字段都没传就返回错误
4. **用 class-validator + ValidationPipe** 做自动校验，减少手写判断
