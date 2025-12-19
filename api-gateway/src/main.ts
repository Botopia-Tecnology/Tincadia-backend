import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RpcExceptionFilter } from './common/filters/rpc-exception.filter';

async function bootstrap() {
  // Parse CORS origins from environment
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

  // API Gateway HTTP
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: [
        ...corsOrigins,
        'https://tincadia.vercel.app',
        'https://tincadia-frontend.vercel.app',
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
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          return Object.values(error.constraints || {})[0];
        });
        return new BadRequestException(messages[0] || 'Error de validación');
      },
    }),
  );

  // Register Global RPC Exception Filter
  app.useGlobalFilters(new RpcExceptionFilter());

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Tincadia API')
    .setDescription('API Gateway para el sistema de microservicios de Tincadia')
    .setVersion('2.0.0')
    .addTag('Authentication', 'Endpoints de autenticación y gestión de usuarios')
    .addTag('Forms', 'Gestión de formularios dinámicos')
    .addTag('Payments', 'Procesamiento de pagos y suscripciones')
    .addTag('Communication', 'Notificaciones y mensajería')
    .addTag('Contacts', 'Sincronización y verificación de contactos')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Tincadia API Docs',
    customfavIcon: 'https://tincadia.vercel.app/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API Gateway running on http://0.0.0.0:${port}`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();

