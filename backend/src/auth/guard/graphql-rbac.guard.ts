// Purpose: role-based access control for GraphQL resolvers, mirroring RBACguard's
//   logic but reading the request from GqlExecutionContext instead of the HTTP-only
//   context RBACguard expects.
// Usage: pair with GraphQLAuthGuard via @UseGuards(GraphQLAuthGuard, GraphQLRBACGuard)
//   on any resolver field decorated with @RBAC(UserRole.<level>).
// Rationale: RBACguard's context.switchToHttp().getRequest() does not resolve under
//   GraphQL's execution context; replaces GraphQLAdminGuard, whose inheritance from
//   GraphQLAuthGuard strengthened canActivate's precondition (an LSP violation).

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '../role/role';
import { RBAC } from '../decorator/rbac.decorator';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class GraphQLRBACGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // It activates when request is allowed
  canActivate(context: ExecutionContext): boolean {
    // Get Role metadata from resolver handler using reflector
    const role = this.reflector.get<UserRole>(RBAC, context.getHandler());

    // Check if the retrieved role has validated enum values as UserRole
    if (!Object.values(UserRole).includes(role)) {
      return true;
    }

    // Switch context to GraphQL and extract the request.
    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req?.user;

    // If a user does not exist in request, deny access.
    if (!user) {
      logger.warn(
        `RBAC denied (GraphQL): no authenticated user (required role=${role})`,
      );
      throw new ForbiddenException('Admin access required');
    }

    // Higher number = more privilege (user=0, admin=1, superadmin=2)
    const accessLevel = {
      [UserRole.user]: 0,
      [UserRole.admin]: 1,
      [UserRole.superadmin]: 2,
    };

    const allowed = accessLevel[user.role] >= accessLevel[role];
    if (!allowed) {
      logger.warn(
        `[user=${user.sub ?? user.id ?? 'unknown'}] RBAC denied (GraphQL): role=${user.role} < required=${role}`,
      );
      throw new ForbiddenException('Admin access required');
    }
    // Admin can access user-level endpoints; exact match is not required
    return true;
  }
}
