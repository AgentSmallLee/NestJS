<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">My Nest Demo</h1>

<p align="center">
  一个基于 <a href="https://nestjs.com/" target="_blank">NestJS</a> 的学习演示项目，用于探索 NestJS 框架的核心概念和最佳实践。
</p>

<p align="center">
  <a href="https://nodejs.org/" target="_blank"><img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js Version" /></a>
  <a href="https://nestjs.com/" target="_blank"><img src="https://img.shields.io/badge/NestJS-12-red.svg" alt="NestJS Version" /></a>
  <a href="https://www.typescriptlang.org/" target="_blank"><img src="https://img.shields.io/badge/TypeScript-6.0-blue.svg" alt="TypeScript Version" /></a>
  <a href="https://pnpm.io/" target="_blank"><img src="https://img.shields.io/badge/pnpm-latest-yellow.svg" alt="pnpm" /></a>
</p>

## 📋 项目简介

这是一个 NestJS 入门学习项目，通过实际代码演示 NestJS 的基础用法，包括模块、控制器、服务、依赖注入等核心概念。

## ✨ 已实现功能

| 模块 | 路径 | 说明 |
|------|------|------|
| User | `/user` | 用户模块 - 基础的 GET/POST 接口 |
| Order | `/order` | 订单模块 - 使用 nest g 命令生成 |

## 🛠️ 技术栈

- **框架**: NestJS 12.x
- **语言**: TypeScript 6.x
- **包管理**: pnpm
- **测试框架**: Vitest
- **代码检查**: oxlint
- **代码格式化**: Prettier

## 📦 安装与运行

### 环境要求

- Node.js >= 18
- pnpm

### 安装依赖

```bash
$ pnpm install
```

### 启动项目

```bash
# 开发模式
$ pnpm run start

# 监听模式（代码修改自动重启）
$ pnpm run start:dev

# 生产模式
$ pnpm run start:prod
```

### 测试

```bash
# 单元测试
$ pnpm run test

# 监听模式
$ pnpm run test:watch

# 测试覆盖率
$ pnpm run test:cov

# e2e 测试
$ pnpm run test:e2e
```

### 其他命令

```bash
# 构建
$ pnpm run build

# 代码检查
$ pnpm run lint

# 代码格式化
$ pnpm run format
```

## 📁 项目结构

```
my-nest-demo/
├── src/
│   ├── app.controller.ts      # 根控制器
│   ├── app.module.ts          # 根模块
│   ├── app.service.ts         # 根服务
│   ├── main.ts                # 应用入口
│   ├── user/                  # 用户模块
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── user.ts
│   └── order/                 # 订单模块
│       ├── order.controller.ts
│       ├── order.module.ts
│       └── order.service.ts
├── test/                      # e2e 测试
├── 笔记-*.txt                 # 学习笔记
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 📚 学习笔记

项目中包含了学习过程中整理的笔记：

- [笔记-NestJS测试文件说明.txt](./笔记-NestJS测试文件说明.txt) - *.spec.ts 测试文件的作用
- [笔记-NestJS控制器路径前缀说明.txt](./笔记-NestJS控制器路径前缀说明.txt) - 控制器路径是否需要加 /

## 🔗 相关资源

- [NestJS 官方文档](https://docs.nestjs.com/)
- [NestJS GitHub](https://github.com/nestjs/nest)
- [TypeScript 官网](https://www.typescriptlang.org/)

## 📝 License

UNLICENSED
