import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const port = parseInt(process.env.formsPort || '3004', 10);

    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
      AppModule,
      {
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port,
          // Increase max message size for large form submissions
          maxMessageSize: 10 * 1024 * 1024, // 10MB
        },
      },
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false, // Allow extra properties for flexibility
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        // Don't throw on validation errors, log them instead
        exceptionFactory: (errors) => {
          console.error('❌ [Forms MS] Validation errors:', errors);
          return new Error('Validation failed');
        },
      }),
    );

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    await app.listen();
    logger.log(`📝 Forms MS running on port ${port}`);
  } catch (error) {
    logger.error('Error starting Forms MS:', error);
    process.exit(1);
  }
}
bootstrap();

