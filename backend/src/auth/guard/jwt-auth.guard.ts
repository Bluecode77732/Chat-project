import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { logger } from 'src/base/logger/logger';

export class JwtAuthGuard extends AuthGuard('jwt-auth-guard') {
  // passport-jwt의 strategy.fail(jwt_err)는 원본 jsonwebtoken 에러를 `info`로 전달하는데,
  // 기본 handleRequest()는 이를 버리고 일반 UnauthorizedException으로 대체하므로 만료된
  // 토큰 실패가 로그상 다른 401들과 구분되지 않았음.
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
