// 목적: 음소거/밴된 유저가 sendMessage 핸들러에 진입하지 못하게 막는 얇은 GraphQL 가드.
// 사용처: chat.resolver.ts의 sendMessage @UseGuards에 추가, req.user를 채우는 GraphQLAuthGuard 다음 순서.
// 근거: 접근 제어는 가드의 책임 — 상태를 갖는 누적/제재 로직은 전부 ModerationService에 위임(SRP).

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserEntity } from 'src/user/entities/user.entity';
import { logger } from 'src/base/logger/logger';
import { ModerationService } from './moderation.service';

@Injectable()
export class ModerationGuard implements CanActivate {
  constructor(private readonly moderationService: ModerationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlCtx = GqlExecutionContext.create(context).getContext<{
      req?: { user?: Pick<UserEntity, 'id' | 'status' | 'bannedUntil'> };
    }>();
    const user = gqlCtx.req?.user;
    if (!user?.id) {
      // GraphQLAuthGuard가 먼저 실행되어 req.user를 채움 — 없으면 미인증.
      throw new ForbiddenException('Authentication required.');
    }

    // 여기서의 밴 체크는 심층 방어 — jwt.strategy가 인증 단계에서 이미 밴 유저를 거부함.
    if (this.moderationService.isBanned(user)) {
      logger.warn(`[user=${user.id}] Blocked by ModerationGuard: banned`);
      throw new ForbiddenException('Your account is banned.');
    }
    if (await this.moderationService.isMuted(user.id)) {
      logger.warn(`[user=${user.id}] Blocked by ModerationGuard: muted`);
      throw new ForbiddenException('You are temporarily muted.');
    }
    return true;
  }
}
