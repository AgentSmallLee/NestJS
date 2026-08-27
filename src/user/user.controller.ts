import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service.js';
import { User } from './user.js';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getUser(): string {
    return this.userService.getUser();
  }

  @Post('create')
  createUser(@Body() user: User): User {
    return this.userService.createUser(user);
  }
}
