import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { GraphQLError } from 'graphql';
import { logger } from 'src/base/logger/logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly isDev = process.env.NODE_ENV !== 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const isGraphQL = host.getType<'http' | 'ws' | 'graphql'>() === 'graphql';

    const status: HttpStatus =
      exception instanceof HttpException
        ? (exception.getStatus() as HttpStatus)
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message: string =
      exception instanceof HttpException
        ? (typeof responseBody === 'object' &&
            responseBody !== null &&
            'message' in responseBody &&
            typeof (responseBody as Record<string, unknown>).message === 'string'
            ? ((responseBody as Record<string, unknown>).message as string)
            : exception.message)
        : 'Internal server error';

    const stack = exception instanceof Error ? exception.stack : undefined;

    logger.error(
      `[${isGraphQL ? 'GraphQL' : 'HTTP'}] ${status} — ${exception instanceof Error ? exception.message : String(exception)}`,
      { stack },
    );

    if (isGraphQL) {
      throw new GraphQLError(message, {
        extensions: {
          code:
            status === HttpStatus.UNAUTHORIZED
              ? 'UNAUTHENTICATED'
              : status === HttpStatus.FORBIDDEN
                ? 'FORBIDDEN'
                : status === HttpStatus.TOO_MANY_REQUESTS
                  ? 'TOO_MANY_REQUESTS'
                  : 'INTERNAL_SERVER_ERROR',
          ...(this.isDev && stack ? { stacktrace: stack } : {}),
        },
      });
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
