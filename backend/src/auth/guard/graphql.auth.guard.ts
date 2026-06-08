import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GraphQLAuthGuard extends AuthGuard('jwt-auth-guard') {
  getRequest(context: ExecutionContext) {
    const GqlCtx = GqlExecutionContext.create(context);
    const ctx = GqlCtx.getContext();
    if (!ctx.req) {
      throw new UnauthorizedException('Unauthorized');
    }
    return ctx.req;
  }
}
