import { Injectable } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdatePostDto } from './dto/update-post.dto.js';

@Injectable()
export class PostService {
    async deletePost(id: string) {
        try {
            await this.prismaService.post.delete({
                where: { id: parseInt(id) },
            });
            return { success: true, message: '帖子删除成功' };
        } catch (e: any) {
            // Prisma P2025：要删除的记录不存在
            if (e.code === 'P2025') {
                return { success: false, message: '帖子不存在' };
            }
            throw e;
        }
    }
    async updatePost(id: string, dto: UpdatePostDto) {
        try {
            const post = await this.prismaService.post.update({
                where: { id: parseInt(id) },
                data: dto,
            });
            return { success: true, data: post };
        } catch (e: any) {
            // Prisma P2025：要更新的记录不存在
            if (e.code === 'P2025') {
                return { success: false, message: '帖子不存在' };
            }
            throw e;
        }
    }

    postList(publish: boolean) {
        const where: any = {}
        if (publish) {
            where.published = publish;
        }
        return this.prismaService.post.findMany({
            where: where,
        });
    }

    constructor(private readonly prismaService: PrismaService) { }

    createPost(createPostDto: CreatePostDto) {
        return this.prismaService.post.create({
            data: createPostDto,
        });
    }
}
