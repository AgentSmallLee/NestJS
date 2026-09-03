import { Module } from '@nestjs/common';
import { LanggraphController } from './langgraph.controller.js';
import { LanggraphService } from './langgraph.service.js';
import { ArticleService } from './article.service.js';
import { ReactAgentService } from './react-agent.service.js';
import { RoutingService } from './routing.service.js';
import { ParalleService } from './paralle.service.js';

@Module({
  controllers: [LanggraphController],
  providers: [LanggraphService, ArticleService, ReactAgentService, RoutingService, ParalleService]
})
export class LanggraphModule {}
