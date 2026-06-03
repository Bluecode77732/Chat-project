import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payload } from '../interface/payload.interface';
import { UserEntity } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { Request } from 'express';
import * as RedisClient from 'redis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt-auth-guard') {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    @Inject('REDIS_CLIENT')
    private readonly redis: RedisClient.RedisClientType,
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
    const isBlackListed = await this.redis.get(`blacklist:${token}`);

    if (isBlackListed) {
      throw new UnauthorizedException(
        `Token has revoked. Sign in again to continue the chatting.`,
      );
    }

    const cached = await this.redis.get(`user_cache:${payload.sub}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const user = await this.userService.findOne(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User Not Found.');
    }

    const { password, ...rest } = user;
    await this.redis.set(`user_cache:${payload.sub}`, JSON.stringify(rest), {
      EX: this.configService.get<number>('USER_CACHE_TTL_SEC', 300),
    });

    return rest;
  }
}
