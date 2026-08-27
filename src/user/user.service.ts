import { Injectable } from '@nestjs/common';
import { User } from './user.js';

@Injectable()
export class UserService {
    
    getUser(): string {
        return 'this is user!';
    }
    createUser(user: User): User {
        return new User(1,"zhangsan",18);
    }
}