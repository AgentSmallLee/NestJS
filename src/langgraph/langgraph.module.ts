import { Module } from '@nestjs/common';
import { LanggraphController } from './langgraph.controller.js';
import { LanggraphService } from './langgraph.service.js';
import { ArticleService } from './article.service.js';
import { ReactAgentService } from './react-agent.service.js';
import { RoutingService } from './routing.service.js';
import { ParallelService } from './paralle.service.js';
import { SupervisorService } from './supervisor.service.js';

@Module({
  controllers: [LanggraphController],
  providers: [LanggraphService, ArticleService, ReactAgentService, RoutingService, ParallelService, SupervisorService]
})
export class LanggraphModule {}
