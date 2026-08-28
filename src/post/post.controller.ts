import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto.js';
import { PostService } from './post.service.js';
import { UpdatePostDto } from './dto/update-post.dto.js';

@Controller('post')
export class PostController {

    constructor(private readonly postService: PostService) { }

    @Post('create')
    createPost(@Body() createPostDto: CreatePostDto) {
        return this.postService.createPost(createPostDto);
    }

    @Get('list')
    postList(@Query('publish') publish: boolean) {
        return this.postService.postList(publish);
    }

    @Put(':id')
    async updatePost(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) {
        return this.postService.updatePost(id, updatePostDto);
    }

    @Delete(':id')
    async deletePost(@Param('id') id: string) {
        return this.postService.deletePost(id);
    }
}

