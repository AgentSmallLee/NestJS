import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { UserService } from './user.service.js';
import { User } from './user.js';
import { log } from 'console';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getUser(): string {
    return this.userService.getUser();
  }

  @Post('create')
  createUser(@Body() user: User): User {
    log(user);
    return this.userService.createUser(user);
  }

  @Get('user/:id')
  getUserById(@Param('id') id: number): User {
    return this.userService.getUserById(id);
  }

  @Get('list')
  getUserList(@Query('name') name: string): User[] {
    log(name);
    return this.userService.getUserList(name);
  }

  @Put('user/:id')
  updateUser(@Param('id') id: string,@Body() user: User) {
    log(user);
    return this.userService.updateUser( id,user);
  }

  @Delete('user/:id')
  deleteUser(@Param('id') id: string) {
    log(id);
    return this.userService.deleteUser( id);
  }
}
