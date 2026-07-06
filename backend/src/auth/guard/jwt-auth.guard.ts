import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { logger } from 'src/base/logger/logger';

export class JwtAuthGuard extends AuthGuard('jwt-auth-guard') {
  // passport-jwt's strategy.fail(jwt_err) surfaces the raw jsonwebtoken error as `info`;
  // the default handleRequest() discards it in favor of a generic UnauthorizedException,
  // so expired-token failures were indistinguishable from other 401s in the logs.
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
