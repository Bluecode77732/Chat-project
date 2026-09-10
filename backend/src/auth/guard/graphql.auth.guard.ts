import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { logger } from 'src/base/logger/logger';
import { Payload } from '../interface/payload.interface';

@Injectable()
export class GraphQLAuthGuard extends AuthGuard('jwt-auth-guard') {
  getRequest(context: ExecutionContext) {
    const GqlCtx = GqlExecutionContext.create(context);
    const ctx = GqlCtx.getContext<{ req?: { user?: Payload } }>();
    if (!ctx.req) {
      throw new UnauthorizedException('Unauthorized');
    }
    return ctx.req;
  }

  // JwtAuthGuard.handleRequest 참고 — GraphQLAuthGuard도 동일한
  // `AuthGuard('jwt-auth-guard')` 믹스인을 독립적으로 상속하므로, GraphQL 경로에서도
  // 토큰 만료 실패를 로깅하려면 자체 오버라이드가 필요.
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
