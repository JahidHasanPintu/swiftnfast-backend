// Create a new file named "logging.middleware.ts"

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        console.log(`${req.method} ${req.url}`);
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        next();
    }
}
