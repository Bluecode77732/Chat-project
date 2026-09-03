import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../role/role';
import { RBAC } from '../decorator/rbac.decorator';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class RBACguard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const role = this.reflector.get<UserRole>(RBAC, context.getHandler());

    if (!Object.values(UserRole).includes(role)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { sub?: number; id?: number; role?: UserRole };
    }>();

    const user = request.user;

    if (!user) {
      logger.warn(`RBAC denied: no authenticated user (required role=${role})`);
      return false;
    }

    // 숫자가 클수록 높은 권한 (user=0, admin=1, superadmin=2)
    const accessLevel = {
      [UserRole.user]: 0,
      [UserRole.admin]: 1,
      [UserRole.superadmin]: 2,
    };

    const allowed =
      accessLevel[user.role ?? UserRole.user] >= accessLevel[role];
    if (!allowed) {
      logger.warn(
        `[user=${user.sub ?? user.id ?? 'unknown'}] RBAC denied: role=${user.role} < required=${role}`,
      );
    }
    // admin은 user 레벨 엔드포인트에 접근 가능; 정확히 일치할 필요는 없음
    return allowed;
  }
}
