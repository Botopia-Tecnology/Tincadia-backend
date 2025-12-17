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
            // Check potential paths for status code
            status = error.statusCode
                || error.status
                || (error.error && error.error.statusCode)
                || (error.error && error.error.status)
                || HttpStatus.INTERNAL_SERVER_ERROR;

            // Check potential paths for message
            message = error.message
                || (error.error && error.error.message)
                || message;

            // If the message is an array (class-validator), take the first one
            if (Array.isArray(message)) {
                message = message[0];
            }
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
