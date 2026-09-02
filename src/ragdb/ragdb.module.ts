import { Module } from '@nestjs/common';
import { RagdbController } from './ragdb.controller.js';
import { RagdbService } from './ragdb.service.js';

@Module({
  controllers: [RagdbController],
  providers: [RagdbService]
})
export class RagdbModule {}
