import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { GraphQLError } from 'graphql';
import * as Sentry from '@sentry/nestjs';
import { logger } from 'src/base/logger/logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly isDev = process.env.NODE_ENV !== 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const isGraphQL = host.getType<'http' | 'ws' | 'graphql'>() === 'graphql';

    // body-parser throws a plain Error (not an HttpException) when the request
    // body exceeds the configured limit — surface it as a clean 413 instead of
    // letting it fall through to a generic "Internal server error".
    const isPayloadTooLarge =
      !(exception instanceof HttpException) &&
      typeof exception === 'object' &&
      exception !== null &&
      'type' in exception &&
      exception.type === 'entity.too.large';

    const status: HttpStatus = isPayloadTooLarge
      ? HttpStatus.PAYLOAD_TOO_LARGE
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message: string = isPayloadTooLarge
      ? '이미지 용량 크기가 너무 커요!'
      : exception instanceof HttpException
        ? typeof responseBody === 'object' &&
          responseBody !== null &&
          'message' in responseBody &&
          typeof (responseBody as Record<string, unknown>).message === 'string'
          ? ((responseBody as Record<string, unknown>).message as string)
          : exception.message
        : 'Internal server error';

    const stack = exception instanceof Error ? exception.stack : undefined;

    const level = Number(status) >= 500 ? 'error' : 'warn';
    logger[level](
      `[${isGraphQL ? 'GraphQL' : 'HTTP'}] ${status} — ${exception instanceof Error ? exception.message : String(exception)}`,
      { stack },
    );
    if (Number(status) >= 500) {
      Sentry.captureException(exception, { extra: { stack, isGraphQL } });
    }

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
