import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  // API Gateway HTTP
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://medilaser.vercel.app',
        /\.devtunnels\.ms$/,
      ],
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Requested-With',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 API Gateway running on http://localhost:${port}`);
}

bootstrap();

