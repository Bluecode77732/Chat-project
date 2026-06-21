import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { logger } from 'src/base/logger/logger';

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

  // See JwtAuthGuard.handleRequest — GraphQLAuthGuard extends the same
  // `AuthGuard('jwt-auth-guard')` mixin independently, so it needs its own override
  // to log expired-token failures on the GraphQL path too.
  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: unknown,
    context: ExecutionContext,
    status?: any,
  ): TUser {
    if (info instanceof Error && info.name === 'TokenExpiredError') {
      logger.warn('Access token expired');
    }
    return super.handleRequest(err, user, info, context, status);
  }
}
