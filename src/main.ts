import 'dotenv/config'  // 加载 .env 文件，让 process.env.DATABASE_URL 等生效
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用关闭钩子，让 Ctrl+C / SIGTERM 时触发 onModuleDestroy 等生命周期
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
