import { Module } from '@nestjs/common';
import { McpClientController } from './mcp-client.controller.js';
import { McpClientService } from './mcp-client.service.js';

@Module({
  controllers: [McpClientController],
  providers: [McpClientService]
})
export class McpClientModule {}
