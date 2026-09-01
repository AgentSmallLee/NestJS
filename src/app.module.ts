import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UserController } from './user/user.controller.js';
import { UserService } from './user/user.service.js';
import { OrderModule } from './order/order.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PostModule } from './post/post.module.js';
import { ModlesModule } from './models/models.module.js';


@Module({
  controllers: [AppController, UserController],
  providers: [AppService, UserService],
  imports: [OrderModule, PrismaModule, PostModule, ModlesModule],
})
export class AppModule {}
