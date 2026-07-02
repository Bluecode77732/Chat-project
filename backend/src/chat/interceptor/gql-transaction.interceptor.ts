// Purpose: opens/commits/rolls back/releases a QueryRunner around a GraphQL mutation,
// mirroring the connect->commit/rollback->release lifecycle for the GraphQL execution path.
// Usage: applied via @UseInterceptors(GqlTransactionInterceptor); pairs with
// GqlQueryRunnerDecorator, which reads the QueryRunner this interceptor attaches to context.req.
// Rationale: GqlExecutionContext.create() is required instead of ctx.switchToHttp() because
// GraphQL requests don't expose the transaction-bearing request object through the HTTP context.

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { DataSource, QueryRunner } from 'typeorm';
import { Observable, catchError, from, mergeMap } from 'rxjs';
import { logger } from 'src/base/logger/logger';

interface GqlTransactionRequest {
  user?: { id?: number };
  queryRunner?: QueryRunner;
  transactionCommitted?: Promise<void>;
}

@Injectable()
export class GqlTransactionInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const gqlCtx = GqlExecutionContext.create(context).getContext<{
      req: GqlTransactionRequest;
    }>();
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    gqlCtx.req.queryRunner = queryRunner;

    let released = false;
    const releaseOnce = async () => {
      if (released || queryRunner.isReleased) return;
      released = true;
      await queryRunner.release();
    };

    let resolveCommitted: (() => void) | undefined;
    gqlCtx.req.transactionCommitted = new Promise<void>((resolve) => {
      resolveCommitted = resolve;
    });

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        await queryRunner.commitTransaction();
        resolveCommitted?.();
        await releaseOnce();
        return result;
      }),
      catchError((error: Error) =>
        from(
          (async () => {
            try {
              await queryRunner.rollbackTransaction();
            } finally {
              await releaseOnce();
            }
            const userId = gqlCtx.req.user?.id;
            logger.error(
              `[user=${userId ?? 'unknown'}] GraphQL transaction rollback: ${error.message}\n${error.stack ?? ''}`,
            );
            throw new InternalServerErrorException('Failed to send message');
          })(),
        ),
      ),
    );
  }
}
