import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';

@Catch()
export class LoggingFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = exception instanceof HttpException ? exception.getStatus() : 500;

        // Log the exception details to a file
        fs.writeFileSync('error.log', `${new Date().toISOString()}: ${exception}\n`, { flag: 'a' });

        response.status(status).json({
            statusCode: status,
            message: 'Internal Server Error',
        });
    }
}
