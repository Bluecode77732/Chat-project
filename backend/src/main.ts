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

  // Without this, OnModuleDestroy hooks (PubSubService, SessionCacheService,
  // ChatGateway) never run on SIGTERM/SIGINT — Redis connections would be
  // dropped abruptly on every deploy instead of closed gracefully.
  app.enableShutdownHooks();

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
    // Front Origin Allowance — comma-separated list, since the main frontend and the
    // admin dashboard run as separate deployments on different origins.
    origin: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()),
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
    .setTitle('Chat API')
    .setDescription(
      [
        'REST API for the Chat application (auth, user and audit-log management).',
        'Real-time chat itself runs over GraphQL subscriptions and Socket.IO and is not documented here.',
        '',
        'Getting started: use the Authentication API — register, then sign in with Basic auth to obtain an access token, and authorize with it (Bearer) to call the protected endpoints.',
      ].join('\n'),
    )
    .setVersion('1.0')
    // Basic auth: register/signin carry email:password in the Authorization header.
    .addBasicAuth()
    // Bearer auth: protected endpoints expect the JWT access token.
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    // Cookie auth: token/refreshaccess reads the httpOnly refreshToken cookie.
    .addCookieAuth('refreshToken')
    .addTag('Authentication API', 'Register, sign in/out and token refresh')
    .addTag('User API', 'User CRUD, role management and force-logout')
    .addTag('Audit Log API', 'Audit trail of privileged actions (admin only)')
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
