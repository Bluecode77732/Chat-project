import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { catchError, Observable, tap } from 'rxjs';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class Transaction implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  // This logic processes logic for response before core functions are called.
  async intercept(
    ctx: ExecutionContext,
    next: CallHandler<string>,
  ): Promise<Observable<string>> {
    const request = ctx.switchToHttp().getRequest<{
      queryRunner?: QueryRunner;
      user?: { sub?: number; id?: number };
    }>();
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    request.queryRunner = queryRunner;

    return next.handle().pipe(
      catchError(async (error) => {
        const userId: number | undefined =
          request.user?.sub ?? request.user?.id;
        logger.error(
          `[user=${userId ?? 'unknown'}] REST transaction rollback: ${(error as Error).message}\n${(error as Error).stack ?? ''}`,
        );
        await queryRunner.rollbackTransaction();
        await queryRunner.release();

        throw error;
      }),
      tap(() => {
        //! Debug - Save message in DB: `rollbackTransaction` => `commitTransaction` which wasn't added.
        void (async () => {
          await queryRunner.commitTransaction();
          await queryRunner.release();
        })();
      }),
    );
  }
}
