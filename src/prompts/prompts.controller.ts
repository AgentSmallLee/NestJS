import { Body, Controller, Post } from '@nestjs/common';
import { PromptsService } from './prompts.service.js';

@Controller('prompts')
export class PromptsController {

    constructor(private readonly promptsService: PromptsService) { }

    @Post('translate')
    chatParser(@Body() { text, targetLanguage }: { text: string, targetLanguage: string }) {
        return this.promptsService.translate(text, targetLanguage)
    }

    @Post('sumarize')
    summarize(@Body() { text, maxWords }: { text: string, maxWords: number }) {
        return this.promptsService.summarize(text, maxWords)
    }

    @Post('classify')
    classify(@Body() { text }: { text: string }) {
        return this.promptsService.classify(text)
    }

    @Post('code-review')
    codeReview(@Body() { code, language }: { code: string, language: string }) {
        return this.promptsService.codeReview(code, language)
    }
}
