import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { RagdbService } from './ragdb.service.js';

@Controller('ragdb')
export class RagdbController {
    constructor(private ragdbService: RagdbService) { }
    
        @Post('load')
        loadDocuments(@Body() body: { documents: { id: string, content: string, source: string }[] }) {
            return this.ragdbService.loadDocuments(body.documents)
        }
    
        @Get('status')
        status() {
            return this.ragdbService.getStatus()
        }
    
        @Post('search')
        search(@Body() body: { query: string, topK: number }) {
            return this.ragdbService.search(body.query, body.topK)
        }
    
        @Post('query')
        query(@Body() body: { query: string, topK: number }) {
            return this.ragdbService.query(body.query, body.topK)
        }
    
        @Delete('clear')
        clear() {
            return this.ragdbService.clear()
        }
}
