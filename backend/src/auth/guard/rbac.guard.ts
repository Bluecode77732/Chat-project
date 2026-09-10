import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../role/role';
import { RBAC } from '../decorator/rbac.decorator';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class RBACguard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // 요청이 허용될 때 활성화됨
  canActivate(context: ExecutionContext): boolean {
    // reflector로 라우트 핸들러에서 Role 메타데이터를 가져옴
    // 요청 파이프라인에서 다음에 실행될 핸들러(메서드)에 대한 참조를 반환.
    const role = this.reflector.get<UserRole>(RBAC, context.getHandler());

    // 가져온 role이 UserRole enum에 유효한 값인지 확인
    if (!Object.values(UserRole).includes(role)) {
      return true;
    }

    // 컨텍스트를 HTTP로 전환해 요청을 추출.
    const request = context.switchToHttp().getRequest<{
      user?: { sub?: number; id?: number; role?: UserRole };
    }>();

    // auth 라우터에서 요청으로부터 인증된 사용자를 가져옴.
    const user = request.user;

    // 요청에 사용자가 없으면 접근을 거부.
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
