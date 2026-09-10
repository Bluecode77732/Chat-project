// 목적: GraphQL 뮤테이션을 감싸 QueryRunner를 열고 커밋/롤백/해제함 —
// GraphQL 실행 경로에서 connect->commit/rollback->release 생명주기를 그대로 따라감.
// 사용처: @UseInterceptors(GqlTransactionInterceptor)로 적용; 이 인터셉터가
// context.req에 붙인 QueryRunner를 읽는 GqlQueryRunnerDecorator와 짝을 이룸.
// 근거: GraphQL 요청은 HTTP 컨텍스트로 트랜잭션이 실린 요청 객체를 노출하지 않으므로
// ctx.switchToHttp() 대신 GqlExecutionContext.create()가 필요함.

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
