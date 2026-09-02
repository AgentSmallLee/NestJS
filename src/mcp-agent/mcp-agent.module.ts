import { Module } from '@nestjs/common';
import { McpAgentController } from './mcp-agent.controller.js';
import { McpAgentService } from './mcp-agent.service.js';

@Module({
  controllers: [McpAgentController],
  providers: [McpAgentService]
})
export class McpAgentModule {}
