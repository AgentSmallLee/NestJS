import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LanggraphService } from './langgraph.service.js';
import { ArticleService } from './article.service.js';

@Controller('langgraph')
export class LanggraphController {


    constructor(
        private readonly langgraphService: LanggraphService,
        private readonly articleService: ArticleService) { }


    @Post('simple-chat')
    simpleChat(@Body() body: { message: string }) {
        return this.langgraphService.simpleChat(body.message);
    }

    @Post('memory-chat')
    memoryChat(@Body() body: { message: string, threadId: string }) {
        return this.langgraphService.memoryChat(body.message, body.threadId);
    }

    @Get('history/:threadId')
    history(@Param('threadId') threadId: string) {
        return this.langgraphService.history(threadId);
    }

    @Post('article')
    processArticle(@Body() body: { article: string }) {
      return this.articleService.process(body.article)
    }
}
