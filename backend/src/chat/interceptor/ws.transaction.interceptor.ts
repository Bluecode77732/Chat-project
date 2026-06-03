import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { catchError, Observable, tap } from 'rxjs';
import { SessionCacheService } from 'src/redis/redis.service';

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
    const client = ctx.switchToWs().getClient();
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
      tap(async () => {
        await queryRunner.commitTransaction();
        await queryRunner.release();

        // cacheMessage runs after commit — prevents stale cache on rollback
        const msg = client.data.pendingCacheMessage;
        if (msg?.room?.id) {
          await this.sessionCacheService.cacheMessage(msg.room.id, msg);
          delete client.data.pendingCacheMessage;
        }
      }),
    );
  }
}
