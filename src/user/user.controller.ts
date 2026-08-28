import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { UserService } from './user.service.js';
import { User } from './user.js';
import { log } from 'console';
import { AddUserDto } from './dto/add-user.dto.js';
import { ModifyUserDto } from './dto/modify-user.dto.js';
import { QueryUserDto } from './dto/query-user.dto.js';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getUser(): string {
    return this.userService.getUser();
  }

   @Get('query')
  queryUser(@Query() query: QueryUserDto) {
    return this.userService.queryUser(query);
  }

  @Post('create')
  createUser(@Body() user: User): User {
    log(user);
    return this.userService.createUser(user);
  }

  @Post('add')
  addUser(@Body() user: AddUserDto) {
    log("addUser"+user);
    return this.userService.addUser(user);
  }

  @Get('user/:id')
  getUserById(@Param('id') id: number): User {
    return this.userService.getUserById(id);
  }

  @Get('list')
  getUserList(@Query('name') name: string) {
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

  @Get(':id')
  findUser(@Param('id') id: string) {
    log(id);
    return this.userService.findUser(id);
  }

  @Delete(':id')
  removeUser(@Param('id') id: string) {
    return this.userService.removeUser(id);
  }

  @Put(':id')
  modifyUser(@Param('id') id: string,@Body() user: ModifyUserDto) {
    log(user);
    return this.userService.modifyUser( id,user);
  }

}
