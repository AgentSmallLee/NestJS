import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ModelsService } from './models.service.js';

@Controller('models')
export class ModelsController {
    constructor(private readonly modelsService: ModelsService) { }

    @Post('chat')
    baseChat(@Body() { message }: { message: string }) {
        return this.modelsService.baseChat(message)
    }

    @Post('chat-system')
    chatSystem(@Body() { system, message }: { system: string, message: string }) {
        return this.modelsService.chatSystem(system, message)
    }

    @Post('chat-stream')
    chatStream(@Body() { message }: { message: string }, @Res() res: Response) {
        return this.modelsService.chatStream(message, res)
    }

    @Post('chat-parser')
    chatParser(@Body() { message }: { message: string }) {
        return this.modelsService.chatParser(message)
    }
}
