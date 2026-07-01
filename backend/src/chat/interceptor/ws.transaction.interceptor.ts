import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { catchError, Observable, tap } from 'rxjs';
import { SessionCacheService, CachableMessage } from 'src/redis/redis.service';
import { logger } from 'src/base/logger/logger';

interface WsClientData {
  queryRunner?: QueryRunner;
  user?: { sub?: number };
  pendingCacheMessage?: CachableMessage & { room?: { id: number } };
}

@Injectable()
export class WebSocketTransaction implements NestInterceptor {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sessionCacheService: SessionCacheService,
  ) {}

  async intercept(
    ctx: ExecutionContext,
    next: CallHandler<string>,
  ): Promise<Observable<string>> {
    const client = ctx.switchToWs().getClient<{ data: WsClientData }>();
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    client.data.queryRunner = queryRunner;

    return next.handle().pipe(
      catchError(async (error) => {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw error;
      }),
      tap(() => {
        void (async () => {
          const userId: number | undefined = client.data.user?.sub;
          try {
            await queryRunner.commitTransaction();
          } catch (err) {
            logger.error(
              `[user=${userId ?? 'unknown'}] WS commit failed: ${(err as Error).message}`,
            );
          } finally {
            await queryRunner.release();
          }

          // cacheMessage runs after commit — prevents stale cache on rollback
          const msg: WsClientData['pendingCacheMessage'] =
            client.data.pendingCacheMessage;
          if (msg?.room?.id) {
            try {
              await this.sessionCacheService.cacheMessage(msg.room.id, msg);
            } catch (cacheErr) {
              logger.warn(
                `[user=${userId ?? 'unknown'}, room=${msg.room.id}] WS cacheMessage failed: ${(cacheErr as Error).message}`,
              );
            }
            delete client.data.pendingCacheMessage;
          }
        })();
      }),
    );
  }
}
