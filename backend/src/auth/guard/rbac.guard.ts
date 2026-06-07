import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../role/role';
import { RBAC } from '../decorator/rbac.decorator';

@Injectable()
export class RBACguard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // It activates when request is allowed
  canActivate(context: ExecutionContext): boolean {
    // Get Role metadata from route handler using reflector
    // Returns a reference to the handler (method) that will be invoked next in the request pipeline.
    const role = this.reflector.get<UserRole>(RBAC, context.getHandler());

    // Check if the retrieved role has validated enum values as UserRole
    if (!Object.values(UserRole).includes(role)) {
      return true;
    }

    // Switch context to HTTP and extract the request.
    const request = context.switchToHttp().getRequest();

    // Get the authenticated user from the request in auth router.
    const user = request.user;

    // If an user does not exist in request, deny access.
    if (!user) {
      return false;
    }

    // Higher number = more privilege (user=0, admin=1)
    const accessLevel = {
      [UserRole.user]: 0,
      [UserRole.admin]: 1,
    };

    // Admin can access user-level endpoints; exact match is not required
    return accessLevel[user.role] >= accessLevel[role];
  }
}
