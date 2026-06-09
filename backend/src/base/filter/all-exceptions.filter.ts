import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { logger } from 'src/base/logger/logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly isDev = process.env.NODE_ENV !== 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const isGraphQL = host.getType<'http' | 'ws' | 'graphql'>() === 'graphql';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any).message ?? exception.message
        : 'Internal server error';

    const stack = exception instanceof Error ? exception.stack : undefined;

    logger.error(
      `[${isGraphQL ? 'GraphQL' : 'HTTP'}] ${status} — ${exception instanceof Error ? exception.message : String(exception)}`,
      { stack },
    );

    if (isGraphQL) {
      return this.isDev
        ? { message, stack }
        : { message };
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(status).json({
      statusCode: status,
      message,
      ...(this.isDev && stack ? { stack } : {}),
    });
  }
}
