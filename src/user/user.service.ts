import { Injectable } from '@nestjs/common';
import { User } from './user.js';
import { log } from 'console';

@Injectable()
export class UserService {
    deleteUser(id: string) {
       log(id)
        const index = this.users.findIndex(u => u.id === parseInt(id));
        if(index === -1){
            return {
                "success": false,
                "message": `user ${id} not found`,
            };
        }
        this.users.splice(index,1);
        return {
            "success": true,
            "message": `user ${id} deleted`,
        };
    }

    private users: User[] = [
        new User(1,"zhangsan",18),
        new User(2,"lisi",18),
    ];

    updateUser(id: string, user: User) {
        log(this.users)
        const index = this.users.findIndex(u => u.id === parseInt(id));
        if(index === -1){
            return {
                "success": false,
                "message": `user ${id} not found`,
            };
        }
        if(index !== -1){
            this.users[index] = user;
        }
        return user;
    }

    getUserList(name: string): User[] {
        return [new User(1,name,18),new User(2,name,18)];
    }

    getUser(): string {
        return 'this is user!';
    }
    createUser(user: User): User {
        return new User(1,"zhangsan",18);
    }

    getUserById(id: number): User {
        return new User(id,"zhangsan",18);
    }
}