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
      // Receiving `req` into `validate()`.
      passReqToCallback: true,
      secretOrKey: configService.getOrThrow('ACCESS_TOKEN_SECRET'),
    });
  }

  // Exclude `password` via `Omit<>` generic type.
  async validate(
    req: Request,
    payload: Payload,
  ): Promise<Omit<UserEntity, 'password'>> {
    const token = req.headers.authorization?.split(' ')[1];

    // Blacklist is a security check with no DB fallback — fail closed on Redis
    // errors rather than let an uncaught exception surface as an opaque 500.
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

    // user_cache is a read-through cache in front of the DB lookup below — a Redis
    // error here is treated the same as a cache miss, not a fatal auth failure.
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

    // Ban gate (auth level): a banned user cannot authenticate, so a still-valid token/session
    // can't be used to bypass the ban. The cache is invalidated on ban, so this reads fresh state.
    if (isEffectivelyBanned(resolved)) {
      logger.warn(`[user=${payload.sub}] Banned user auth attempt blocked`);
      throw new UnauthorizedException('Your account has been suspended.');
    }

    return resolved;
  }
}
