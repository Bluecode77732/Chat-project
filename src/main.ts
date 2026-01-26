import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { logger } from './base/logger/logger';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Direct import of logger
    // It catches all bootstrap and failure errors when starting, which occurs before app.module.
    logger: WinstonModule.createLogger(logger),
  });

  // Use pipes in class-validator and class-transformer libraries
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle("Chat")
    .setDescription("Go to Auth section and register a user to issue an access token to test out.")
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
