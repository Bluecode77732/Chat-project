// 목적: sendMessage 외 인증된 GraphQL query/mutation 전반에 호출 빈도 제한을 적용.
// 사용처: chat.resolver.ts의 getOnlineUser 등 RateLimitGuard가 붙지 않은 나머지 핸들러에서
// @UseGuards(..., QueryRateLimitGuard)로 사용 — sendMessage에는 RateLimitGuard가 이미 있어 붙이지 않음.
// 근거: RateLimitGuard와 카운터/moderation 연동을 공유하면 getOnlineUser의 5초 폴링만으로
// sendMessage 예산이 소모되고 moderation 스트라이크까지 쌓여 별도 가드로 분리함(ADR 0016 참고).

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Inject,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import Redis from 'ioredis';
import { logger } from 'src/base/logger/logger';

const WINDOW_SEC = 15;
const MAX_REQUESTS = 30;

@Injectable()
export class QueryRateLimitGuard implements CanActivate {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlCtx = GqlExecutionContext.create(context).getContext<{
      req?: { user?: { id?: number } };
    }>();
    const userId = gqlCtx.req?.user?.id;

    if (!userId) {
      throw new HttpException('Cannot Find User Id', HttpStatus.UNAUTHORIZED);
    }

    try {
      const key = `chat:query_rate_limit:${userId}`;
      // Lua 스크립트로 INCR과 EXPIRE를 원자적으로 실행 —
      // 두 명령 사이에 서버가 크래시해도 영구 key가 남지 않도록 방지
      const luaScript = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], ${WINDOW_SEC})
        end
        return count
      `;
      const count = (await this.redis.eval(luaScript, 1, key)) as number;

      if (count > MAX_REQUESTS) {
        logger.warn(
          `[user=${userId}] Query rate limit exceeded (count=${count})`,
        );
        throw new HttpException(
          'Rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (err) {
      // 의도된 guard 예외는 그대로 재던져서 NestJS가 올바른 status를 전파하도록 함
      if (err instanceof HttpException) {
        throw err;
      }
      // 예상치 못한 에러(예: Redis 다운) → fail-open. RateLimitGuard(sendMessage)와 달리
      // 이 가드는 moderation과 연동되지 않는 순수 조회 스로틀링이라, 장애 시 막았을 때
      // 잃는 것(방 목록·대화 내역 조회 등 앱 전체 사용 불가)이 열었을 때 잃는 것(잠시 동안
      // 조회 제한 미적용)보다 크다고 판단함 — 상세 근거는 ADR 0016 참고.
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? (err.stack ?? '') : '';
      logger.error(
        `[user=${userId}] Query rate limit guard error, failing open: ${errMessage}\n${errStack}`,
      );
      return true;
    }
  }
}
