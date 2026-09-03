import { Module } from '@nestjs/common';
import { LanggraphController } from './langgraph.controller.js';
import { LanggraphService } from './langgraph.service.js';

@Module({
  controllers: [LanggraphController],
  providers: [LanggraphService]
})
export class LanggraphModule {}
