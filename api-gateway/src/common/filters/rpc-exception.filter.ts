import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
    catch(exception: RpcException, host: ArgumentsHost) {
        const error: any = exception.getError();
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        // Default status code and message
        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';

        if (typeof error === 'object' && error !== null) {
            status = error.statusCode || error.status || HttpStatus.INTERNAL_SERVER_ERROR;
            message = error.message || message;
        } else {
            message = error;
        }

        response.status(status).json({
            statusCode: status,
            message,
            error: error.error || 'Error',
        });
    }
}
