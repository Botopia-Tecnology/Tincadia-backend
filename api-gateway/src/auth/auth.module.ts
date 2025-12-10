import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.authHost || '127.0.0.1',
          port: parseInt(process.env.authPort || '3002'),
        },
      },
    ]),
  ],
  controllers: [AuthController],
})
export class AuthModule { }

