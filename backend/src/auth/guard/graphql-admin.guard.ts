import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GraphQLAuthGuard } from './graphql.auth.guard';
import { UserRole } from '../role/role';

@Injectable()
export class GraphQLAdminGuard extends GraphQLAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = await super.canActivate(context);
    if (!result) return false;
    const req = this.getRequest(context) as { user?: { role?: number } };
    if ((req.user?.role ?? -1) < UserRole.admin) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
