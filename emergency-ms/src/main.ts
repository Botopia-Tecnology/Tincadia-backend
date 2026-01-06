import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const port = parseInt(process.env.emergencyPort || '3009', 10);

    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        AppModule,
        {
            transport: Transport.TCP,
            options: {
                host: '::',
                port,
            },
        },
    );

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    await app.listen();
    console.log(`🚑 Emergency MS running on 0.0.0.0:${port}`);
}
bootstrap();
