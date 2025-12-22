import { Catch, RpcExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

@Catch()
export class AllExceptionsFilter implements RpcExceptionFilter<any> {
  catch(exception: any, host: ArgumentsHost): Observable<any> {
    const error = exception?.response || exception?.message || exception;

    return throwError(
      () =>
        new RpcException({
          statusCode: exception?.status || exception?.statusCode || 500,
          message: error?.message || error || 'Internal server error',
          error: error?.error || 'Error',
        }),
    );
  }
}









