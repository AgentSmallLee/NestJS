import { Module } from '@nestjs/common';
import { ModlesService } from './models.service.js';
import { ModlesController } from './models.controller.js';

@Module({
  controllers: [ModlesController],
  providers: [ModlesService]
})
export class ModlesModule {}
