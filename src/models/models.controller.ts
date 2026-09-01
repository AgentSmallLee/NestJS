import { Body, Controller, Post, Res } from '@nestjs/common';
import { ModlesService } from './models.service.js';
import type { Response } from 'express';

@Controller('models')
export class ModlesController {
    constructor(private readonly modulesService: ModlesService) { }

    @Post('chat')
    baseChat(@Body() { message }: { message: string }) {
        return this.modulesService.baseChat(message)
    }

    @Post('chat-system')
    chatSystem(@Body() { system, message }: { system: string, message: string }) {
        return this.modulesService.chatSystem(system, message)
    }

    @Post('chat-stream')
    chatStream(@Body() { message }: { message: string }, @Res() res: Response) {
        return this.modulesService.chatStream(message, res)
    }

    @Post('chat-parser')
    chatParser(@Body() { message }: { message: string }) {
        return this.modulesService.chatParser(message)
    }
}
