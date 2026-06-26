import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { logger } from './base/logger/logger';
import { AllExceptionsFilter } from './base/filter/all-exceptions.filter';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Direct import of logger
    // It catches all bootstrap and failure errors when starting, which occurs before app.module.
    logger: WinstonModule.createLogger(logger),
  });

  // Use pipes in class-validator and class-transformer libraries
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Default Express body limit (100kb) is far smaller than a base64-encoded
  // profile image (~2.8MB at the 2MB raw-image cap) — raise it accordingly.
  app.useBodyParser('json', { limit: '3mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '3mb' });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Implementing CORS
  app.enableCors({
    // Front Origin Allowance
    origin: process.env.CORS_ORIGIN,
    // Cookie Authorization In Header Allowance
    credentials: true,
    // Allowance Method
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // Allowance Header
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'apollo-require-preflight',
    ],
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Chat')
    .setDescription(
      'Go to Auth section and register a user to issue an access token to test out.',
    )
    .setVersion('1.0')
    .addBasicAuth()
    .addBearerAuth()
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('document', app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Only bare `pnpm start:dev` (NODE_ENV=development) is restricted to loopback.
  // docker-compose sets NODE_ENV=docker and Railway's value is unconfirmed in this repo,
  // so both must keep binding to 0.0.0.0 or the container/proxy can't reach the app.
  const host = process.env.NODE_ENV === 'development' ? '127.0.0.1' : '0.0.0.0';
  await app.listen(process.env.PORT ?? 3000, host);
  logger.info(`Server running on ${host}:${process.env.PORT ?? 3000}`);
}
bootstrap().catch(console.error);
