// 목적: GraphQL 리졸버용 역할 기반 접근 제어 — RBACguard와 동일한 로직이지만
//   RBACguard가 기대하는 HTTP 전용 컨텍스트 대신 GqlExecutionContext에서 요청을 읽음.
// 사용처: @RBAC(UserRole.<level>)이 붙은 리졸버 필드에서
//   @UseGuards(GraphQLAuthGuard, GraphQLRBACGuard)로 GraphQLAuthGuard와 함께 사용.
// 근거: RBACguard의 context.switchToHttp().getRequest()는 GraphQL 실행 컨텍스트에서
//   동작하지 않음; GraphQLAuthGuard를 상속해 canActivate의 전제조건을 강화했던
//   (LSP 위반) GraphQLAdminGuard를 대체.

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '../role/role';
import { RBAC } from '../decorator/rbac.decorator';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class GraphQLRBACGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // 요청이 허용될 때 활성화됨
  canActivate(context: ExecutionContext): boolean {
    // reflector로 리졸버 핸들러에서 Role 메타데이터를 가져옴
    const role = this.reflector.get<UserRole>(RBAC, context.getHandler());

    // 가져온 role이 UserRole enum에 유효한 값인지 확인
    if (!Object.values(UserRole).includes(role)) {
      return true;
    }

    // 컨텍스트를 GraphQL로 전환해 요청을 추출.
    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext<{
      req?: { user?: { sub?: number; id?: number; role?: UserRole } };
    }>().req?.user;

    // 요청에 사용자가 없으면 접근을 거부.
    if (!user) {
      logger.warn(
        `RBAC denied (GraphQL): no authenticated user (required role=${role})`,
      );
      throw new UnauthorizedException();
    }

    // UserRole enum 값은 이미 숫자(user=0, admin=1, superadmin=2).
    const allowed = (user.role ?? UserRole.user) >= role;
    if (!allowed) {
      logger.warn(
        `[user=${user.sub ?? user.id ?? 'unknown'}] RBAC denied (GraphQL): role=${user.role} < required=${role}`,
      );
      throw new ForbiddenException();
    }
    return true;
  }
}
