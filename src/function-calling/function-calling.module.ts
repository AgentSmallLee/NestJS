import { Module } from '@nestjs/common';
import { FunctionCallingController } from './function-calling.controller.js';
import { FunctionCallingService } from './function-calling.service.js';

@Module({
  controllers: [FunctionCallingController],
  providers: [FunctionCallingService]
})
export class FunctionCallingModule {}
