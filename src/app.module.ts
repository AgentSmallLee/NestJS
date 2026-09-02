import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UserController } from './user/user.controller.js';
import { UserService } from './user/user.service.js';
import { OrderModule } from './order/order.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PostModule } from './post/post.module.js';
import { PromptsModule } from './prompts/prompts.module.js';
import { ChainsModule } from './chains/chains.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { MemoryModule } from './memory/memory.module.js';
import { ModelsModule } from './models/models.module.js';
import { RagModule } from './rag/rag.module.js';
import { FunctionCallingModule } from './function-calling/function-calling.module.js';
import { RagdbModule } from './ragdb/ragdb.module.js';


@Module({
  controllers: [AppController, UserController],
  providers: [AppService, UserService],
  imports: [OrderModule, PrismaModule, PostModule, ModelsModule, PromptsModule, ChainsModule, AgentsModule, MemoryModule, RagModule, FunctionCallingModule, RagdbModule],
})
export class AppModule {}
