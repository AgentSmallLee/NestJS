import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderService {
    getOrder(): string {
        return 'this is order service!';
    }

}
