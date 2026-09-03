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

    // body-parser는 요청 body가 설정된 제한을 초과하면 HttpException이 아닌 일반 Error를
    // 던짐 — 일반적인 "Internal server error"로 흘러가지 않도록 깔끔한 413으로 변환.
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
