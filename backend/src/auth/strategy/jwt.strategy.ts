import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payload } from '../interface/payload.interface';
import { UserEntity } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { isEffectivelyBanned } from 'src/moderation/moderation.util';
import { Request } from 'express';
import Redis from 'ioredis';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt-auth-guard') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // `validate()`에 `req`를 전달받음.
      passReqToCallback: true,
      secretOrKey: configService.getOrThrow('ACCESS_TOKEN_SECRET'),
    });
  }

  // `Omit<>` 제네릭 타입으로 `password`를 제외.
  async validate(
    req: Request,
    payload: Payload,
  ): Promise<Omit<UserEntity, 'password'>> {
    const token = req.headers.authorization?.split(' ')[1];

    // 블랙리스트는 DB fallback 없는 보안 체크 — 처리되지 않은 예외로 불명확한 500이
    // 노출되지 않도록 Redis 에러 시 fail closed.
    let isBlackListed: string | null;
    try {
      isBlackListed = await this.redis.get(`blacklist:${token}`);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.error(
        `[user=${payload.sub}] Redis unavailable during blacklist check, failing closed: ${errMessage}`,
      );
      throw new UnauthorizedException(
        'Authentication temporarily unavailable. Please try again.',
      );
    }

    if (isBlackListed) {
      logger.warn(`[user=${payload.sub}] Blacklisted token used`);
      throw new UnauthorizedException(
        `Token has revoked. Sign in again to continue the chatting.`,
      );
    }

    let resolved: Omit<UserEntity, 'password'> | null = null;

    // user_cache는 아래 DB 조회 앞단의 read-through 캐시 — 여기서 Redis 에러는
    // 치명적 인증 실패가 아니라 캐시 미스와 동일하게 처리.
    let cached: string | null = null;
    try {
      cached = await this.redis.get(`user_cache:${payload.sub}`);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.warn(
        `[user=${payload.sub}] Redis unavailable for user_cache read, falling through to DB: ${errMessage}`,
      );
    }
    if (cached) {
      try {
        resolved = JSON.parse(cached) as Omit<UserEntity, 'password'>;
      } catch {
        logger.warn(
          `[user=${payload.sub}] Corrupt cache entry, falling through to DB lookup`,
        );
      }
    }

    if (!resolved) {
      const user = await this.userService.findOne(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User Not Found.');
      }

      const { password: _password, ...rest } = user;
      try {
        await this.redis.set(
          `user_cache:${payload.sub}`,
          JSON.stringify(rest),
          'EX',
          this.configService.get<number>('USER_CACHE_TTL_SEC', 300),
        );
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        logger.warn(
          `[user=${payload.sub}] Redis unavailable for user_cache write, continuing without cache: ${errMessage}`,
        );
      }
      resolved = rest;
    }

    // Ban 게이트(인증 레벨): banned user는 인증 자체가 불가 — 여전히 유효한 token/session으로
    // ban을 우회할 수 없음. ban 시 캐시가 무효화되므로 항상 최신 상태를 읽음.
    if (isEffectivelyBanned(resolved)) {
      logger.warn(`[user=${payload.sub}] Banned user auth attempt blocked`);
      throw new UnauthorizedException('Your account has been suspended.');
    }

    return resolved;
  }
}
