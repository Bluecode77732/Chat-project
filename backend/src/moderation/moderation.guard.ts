// Purpose: thin GraphQL gate that blocks a muted or banned user from entering the sendMessage handler.
// Usage: added to chat.resolver.ts sendMessage @UseGuards, after GraphQLAuthGuard (which populates req.user).
// Rationale: access control is a guard concern; all stateful accrual/enforcement is delegated to ModerationService (SRP).

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserEntity } from 'src/user/entities/user.entity';
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
      // GraphQLAuthGuard runs first and populates req.user; absence means unauthenticated.
      throw new ForbiddenException('Authentication required.');
    }

    // Ban is defense-in-depth here — jwt.strategy already rejects a banned user at auth.
    if (this.moderationService.isBanned(user)) {
      throw new ForbiddenException('Your account is banned.');
    }
    if (await this.moderationService.isMuted(user.id)) {
      throw new ForbiddenException('You are temporarily muted.');
    }
    return true;
  }
}
