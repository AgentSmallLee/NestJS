import { Controller, Post, Body } from '@nestjs/common';
import { ChainsService } from './chains.service.js';

@Controller('chains')
export class ChainsController {
    constructor(private readonly chainsService: ChainsService) {}

    @Post('polish')
    polish(@Body() { article }: { article: string }) {
        return this.chainsService.polish(article)
    }

    @Post('blog')
    generateBlog(@Body() { keywords,style }: { keywords: string,style: string }) {
        return this.chainsService.generateBlog(keywords,style)
    }

    @Post('router')
    smartRouter(@Body() { question }: { question: string }) {
        return this.chainsService.smartRouter(question)
    }
}
