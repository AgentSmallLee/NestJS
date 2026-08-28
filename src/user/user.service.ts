import { Injectable } from '@nestjs/common';
import { User } from './user.js';
import { log } from 'console';
import { AddUserDto } from './dto/add-user.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ModifyUserDto } from './dto/modify-user.dto.js';
import { QueryUserDto } from './dto/query-user.dto.js';

@Injectable()
export class UserService {

    async queryUser(query: QueryUserDto) {
        // 1. 分页参数加默认值
        const pageNum = parseInt(query.pageNum) || 1;
        const pageSize = parseInt(query.pageSize) || 10;
        const skip = (pageNum - 1) * pageSize;
        const take = pageSize;

        // 2. where 条件动态组装：有值才加进去，避免 undefined 字段
        const where: any = {};
        if (query.name) {
            where.name = query.name;
        }
        if (query.role) {
            where.role = query.role;
        }

        // 3. 用 $transaction 同时查列表和总数，性能更好且数据一致
        const [list, total] = await this.prismaService.$transaction([
            this.prismaService.user.findMany({
                where,
                skip,
                take,
                orderBy: { id: 'desc' },
            }),
            this.prismaService.user.count({ where }),
        ]);

        // 计算总页数（向上取整）
        const totalPage = Math.ceil(total / pageSize);

        return {
            total,          // 总条数
            totalPage,      // 总页数
            pageNum,        // 当前页码
            pageSize,       // 每页条数
            list,           // 当前页数据
        };
    }
    async removeUser(id: string) {
        const user =await this.prismaService.user.delete({
            where: {
                id: parseInt(id),
            },
        });
        if (!user) {
            return {
                "success": false,
                "message": `user ${id} not found,can not delete it`,
            };
        }
        return {
            "success": true,
            "message": `user ${id} deleted`,
        };
    }

    constructor(private readonly prismaService: PrismaService) { }

    deleteUser(id: string) {
        log(id)
        const index = this.users.findIndex(u => u.id === parseInt(id));
        if (index === -1) {
            return {
                "success": false,
                "message": `user ${id} not found`,
            };
        }
        this.users.splice(index, 1);
        return {
            "success": true,
            "message": `user ${id} deleted`,
        };
    }

    private users: User[] = [
        new User(1, "zhangsan", 18),
        new User(2, "lisi", 18),
    ];

    updateUser(id: string, user: User) {
        log(this.users)
        const index = this.users.findIndex(u => u.id === parseInt(id));
        if (index === -1) {
            return {
                "success": false,
                "message": `user ${id} not found`,
            };
        }
        if (index !== -1) {
            this.users[index] = user;
        }
        return user;
    }

    async getUserList(name: string) {
        const userList = await this.prismaService.user.findMany();
        return {
            total: userList.length,
            list: userList
        };
    }

    getUser(): string {
        return 'this is user!';
    }
    createUser(user: User): User {
        return new User(1, "zhangsan", 18);
    }

    getUserById(id: number): User {
        return new User(id, "zhangsan", 18);
    }

    async addUser(dto: AddUserDto) {
        const user = await this.prismaService.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                password: dto.password,
                role: dto.role,
            },
        });
        return {
            "success": true,
            "data": user,
        };
    }

    async findUser(id: string) {
        const user = await this.prismaService.user.findUnique({
            where: {
                id: parseInt(id),
            },

            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                posts: {
                    select: {
                        id: true,
                        title: true,
                        content: true,
                    }
                }
            }
        });
        if (!user) {
            return {
                "success": false,
                "message": `user ${id} not found`,
            };
        }
        return user;
    }

    async modifyUser(id: string, user: ModifyUserDto) {
        const foundUser = await this.prismaService.user.findUnique({
            where: {
                id: parseInt(id),
            },
        });
        if (!foundUser) {
            return {
                "success": false,
                "message": `user ${id} not found,can not modify it`,
            };
        }
        await this.prismaService.user.update({
            where: {
                id: parseInt(id),
            },
            data: {
                name: user.name,
                password: user.password,
            },
        });
    }
}