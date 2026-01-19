import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';

@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(RpcExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();



        this.logger.error('⚠️ Exception caught by Global Filter:', exception);
        // Debug: Print the exact structure of the incoming exception to understand why message is lost
        console.log('DEBUG RPC FILTER - Exception Object:', JSON.stringify(exception, null, 2));

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let errorName = 'Internal Server Error';

        // 1. Si es una excepción HTTP estándar (lanzada por el propio Gateway)
        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res: any = exception.getResponse();
            if (typeof res === 'object') {
                message = res.message || message;
                errorName = res.error || errorName;
            } else {
                message = res;
            }
        }
        // 2. Si es un error que viene de un Microservicio (RpcException o objeto genérico)
        else if (exception) {
            let errorObj = exception as any;

            // CASO ESPECÍFICO: RpcException de NestJS Microservices
            // Los RpcException envuelven el payload real y se accede con .getError()
            if (typeof errorObj.getError === 'function') {
                errorObj = errorObj.getError();
            }

            // Intenta extraer status y mensaje de varias estructuras comunes
            if (errorObj.response && typeof errorObj.response === 'object') {
                const potentialStatus = errorObj.response.statusCode || errorObj.status;
                if (typeof potentialStatus === 'number') status = potentialStatus;

                message = errorObj.response.message || message;
                errorName = errorObj.response.error || errorName;
            }
            else if (errorObj.statusCode || errorObj.status) {
                const potentialStatus = errorObj.statusCode || errorObj.status;
                if (typeof potentialStatus === 'number') status = potentialStatus;

                message = errorObj.message || message;
                errorName = errorObj.error || errorName;
            }
            else if (errorObj.message) {
                message = errorObj.message;
                if (errorObj.error?.statusCode && typeof errorObj.error.statusCode === 'number') {
                    status = errorObj.error.statusCode;
                }
            }
        }

        // Validación final de seguridad para el status
        if (typeof status !== 'number' || isNaN(status) || status < 100 || status > 599) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        // Asegurar que el mensaje no sea un array (class-validator a veces devuelve array)
        if (Array.isArray(message)) {
            message = message[0];
        }

        // Log final para verificar qué estamos respondiendo
        // Log final para verificar qué estamos respondiendo

        response.status(status).json({
            statusCode: status,
            message: message,
            error: errorName,
        });
    }
}
