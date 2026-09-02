import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { RagService } from './rag.service.js';

@Controller('rag')
export class RagController {

    constructor(private ragService: RagService) { }

    @Post('load')
    loadDocuments(@Body() body: { documents: { id: string, content: string, source: string }[] }) {
        return this.ragService.loadDocuments(body.documents)
    }

    @Get('status')
    status() {
        return this.ragService.getStatus()
    }

    @Post('search')
    search(@Body() body: { query: string, topK: number }) {
        return this.ragService.search(body.query, body.topK)
    }

    @Post('query')
    query(@Body() body: { query: string, topK: number }) {
        return this.ragService.query(body.query, body.topK)
    }

    @Delete('clear')
    clear() {
        return this.ragService.clear()
    }
}
