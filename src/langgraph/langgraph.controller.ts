import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LanggraphService } from './langgraph.service.js';
import { ArticleService } from './article.service.js';
import { ReactAgentService } from './react-agent.service.js';
import { RoutingService } from './routing.service.js';
import { ParallelService } from './paralle.service.js';
import { SupervisorService } from './supervisor.service.js';



@Controller('langgraph')
export class LanggraphController {


    constructor(
        private readonly langgraphService: LanggraphService,
        private readonly articleService: ArticleService,
        private readonly reactSvc: ReactAgentService,
        private readonly routingSvc: RoutingService,
        private readonly parallelSvc: ParallelService,
        private readonly supervisorSvc: SupervisorService
    ) { }


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

    // ── 第二章接口 ──────────────────────────────────────
    @Post('react-chat')
    reactChat(@Body() body: { threadId: string; message: string }) {
        return this.reactSvc.chat(body.threadId, body.message)
    }


    // 条件路由
    @Post('route')
    route(@Body() body: { input: string }) {
      return this.routingSvc.handle(body.input)
    }

    // 并行
    @Post('parallel')
    parallel(@Body() body: { task: string }) {
      return this.parallelSvc.parallelChat(body.task)
    }

    // 任务分配
    @Post('supervisor')
    supervisor(@Body() body: { input: string }) {
      return this.supervisorSvc.run(body.input)
    }
}
