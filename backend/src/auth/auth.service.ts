import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UserEntity } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from './role/role';
import { logger } from 'src/base/logger/logger';
import Redis from 'ioredis';
import { Payload } from './interface/payload.interface';
import { isEffectivelyBanned } from 'src/moderation/moderation.util';

type JwtPayload = Payload & { iat: number; exp: number };

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  parseBasicToken(rawToken: string) {
    if (!rawToken) {
      logger.warn('Bad Token Format: missing Authorization header');
      throw new BadRequestException('Bad Token Format.');
    }

    const basicToken = rawToken.split(' ');

    if (basicToken.length !== 2) {
      logger.warn('Bad Token Format: invalid token segment count');
      throw new BadRequestException('Bad Token Format.');
    }

    const [basic, token] = basicToken;

    if (basic.toLowerCase() !== 'basic') {
      logger.warn('Bad Token Format: missing Basic prefix');
      throw new BadRequestException('Bad Token Format.');
    }

    const decoded = Buffer.from(token, 'base64').toString('utf-8');

    const tokenSplit = decoded.split(':');

    if (!(tokenSplit.length == 2)) {
      logger.warn(
        'Bad Token Format: decoded token missing email:password structure',
      );
      throw new BadRequestException('Bad Token Format.');
    }

    const [email, password] = tokenSplit;

    logger.debug(`User '${email}' parsed a basic token`);

    return {
      email,
      password,
    };
  }

  async register(rawToken: string, nickname?: string) {
    const { email, password } = this.parseBasicToken(rawToken);

    const user = await this.userRepository.findOne({
      where: {
        email,
      },
    });

    if (user) {
      logger.warn(`Registration attempt for already-existing email: ${email}`);
      throw new BadRequestException('User Already Exist.');
    }

    if (nickname) {
      const existingNickname = await this.userRepository.findOne({
        where: { nickname },
      });
      if (existingNickname) {
        throw new BadRequestException('Nickname already in use.');
      }
    }

    const hash = await bcrypt.hash(
      password,
      this.configService.getOrThrow<number>('HASH_ROUNDS'),
    );

    await this.userRepository.save({
      email,
      password: hash,
      role: UserRole.user,
      nickname,
    });

    logger.info(`User '${email}' is registered`);

    return await this.userRepository.findOne({
      where: {
        email,
      },
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: {
        email,
      },
    });

    if (!user) {
      logger.warn(`Login attempt for non-existent email: ${email}`);
      throw new BadRequestException('Invalid User.');
    }

    if (user.isAI) {
      logger.warn(`Blocked login attempt for AI system account: ${email}`);
      throw new BadRequestException('Invalid User.');
    }

    const verification = await bcrypt.compare(password, String(user.password));

    if (!verification) {
      logger.warn(`Password mismatch for email: ${email}`);
      throw new BadRequestException('Invalid User.');
    }

    logger.debug(`User '${email}' is authenticated`);
    return user;
  }

  async issueToken(
    user: { id: number | undefined; role: UserRole | undefined },
    isRefreshToken: boolean,
  ) {
    const refreshToken = this.configService.getOrThrow<string>(
      'REFRESH_TOKEN_SECRET',
    );
    const accessToken = this.configService.getOrThrow<string>(
      'ACCESS_TOKEN_SECRET',
    );
    const expiresIn = this.configService.getOrThrow<number>(
      isRefreshToken
        ? 'REFRESH_TOKEN_SECRET_EXPIRES_IN'
        : 'ACCESS_TOKEN_SECRET_EXPIRES_IN',
    );

    // 새로 발급된 refresh token이 이 사용자의 유일한 유효 토큰이 됨 — 여기서 id를
    // 기록해두면 이후 로그인(예: 다른 브라우저)이 이전 토큰을 대체할 수 있고,
    // `parseBearerToken`이 갱신 시 이 값을 검사.
    const jti = isRefreshToken ? randomUUID() : undefined;
    if (jti) {
      await this.redis.set(`auth:session:${user.id}`, jti, 'EX', expiresIn);
    }

    logger.debug(`User '${user.id}' issued refresh and access tokens`);

    return await this.jwtService.signAsync(
      {
        sub: user.id,
        type: isRefreshToken ? 'refresh' : 'access',
        role: user.role,
        ...(jti ? { jti } : {}),
      },
      // refresh와 access 토큰은 서로 다른 secret으로 서명하므로, auth.module.ts의
      // JwtModule에 설정하지 않고 호출마다 전달.
      {
        secret: isRefreshToken ? refreshToken : accessToken,
        expiresIn,
      },
    );
  }

  async parseBearerToken(
    rawToken: string,
    isRefreshToken: boolean,
  ): Promise<JwtPayload> {
    // jsonwebtoken의 다양한 에러 타입을 하나의 UnauthorizedException으로 통일
    let payload: JwtPayload;
    try {
      const bearerToken = rawToken.split(' ');

      if (!(bearerToken.length == 2)) {
        throw new BadRequestException('Bad Token Format.');
      }

      const [bearer, token] = bearerToken;

      if (bearer.toLowerCase() !== 'bearer') {
        throw new BadRequestException('Bad Token Format.');
      }

      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>(
          isRefreshToken ? 'REFRESH_TOKEN_SECRET' : 'ACCESS_TOKEN_SECRET',
        ),
      });

      if (isRefreshToken) {
        if (payload.type !== 'refresh') {
          throw new BadRequestException('Insert Refresh Token.');
        }
      } else {
        if (payload.type !== 'access') {
          throw new BadRequestException('Insert Access Token.');
        }
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.warn(errMessage);
      throw new UnauthorizedException('Token Expired');
    }

    // 위 try/catch 밖에 둬서, 공통 'Token Expired'로 뭉뚱그려지지 않고
    // 서로 다른 메시지가 클라이언트에 전달되도록 함.
    if (!isRefreshToken) {
      const token = rawToken.split(' ')[1];
      const isBlacklisted = await this.redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        logger.warn(`Revoked access token used for WS/socket connection`);
        throw new UnauthorizedException('Token has been revoked.');
      }
    }

    if (isRefreshToken) {
      const currentJti = await this.redis.get(`auth:session:${payload.sub}`);
      if (!currentJti || currentJti !== payload.jti) {
        logger.warn(`Refresh token superseded for user '${payload.sub}'`);
        throw new UnauthorizedException('Session Superseded');
      }
    }

    logger.debug('User parsed a bearer token successfully');
    return payload;
  }

  async signIn(rawToken: string) {
    const { email, password } = this.parseBasicToken(rawToken);

    const user = await this.validateUser(email, password);

    logger.info(`User '${email}' signed in. Say Hi.`);

    return {
      refreshToken: await this.issueToken(
        { id: user.id, role: user.role },
        true,
      ),
      accessToken: await this.issueToken(
        { id: user.id, role: user.role },
        false,
      ),
    };
  }

  async refreshAccessToken(rawToken: string): Promise<{ accessToken: string }> {
    const payload = await this.parseBearerToken(rawToken, true);
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User Not Found.');
    }
    // 인증 단계의 밴 차단: 밴된 사용자가 새 access token을 발급받을 수 있으면 안 됨 —
    // 그렇지 않으면 클라이언트의 silent-refresh 재시도가 jwt.strategy의 밴 체크에 걸려 루프에 빠짐.
    if (isEffectivelyBanned(user)) {
      logger.warn(`[user=${user.id}] Banned user attempted token refresh`);
      throw new UnauthorizedException('Account Suspended');
    }
    return {
      accessToken: await this.issueToken(
        { id: user.id, role: user.role },
        false,
      ),
    };
  }

  async signOut(rawToken: string) {
    const payload = await this.parseBearerToken(rawToken, false);

    const ttl = payload.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      await this.redis.set(
        `blacklist:${rawToken.split(' ')[1]}`,
        '1',
        'EX',
        ttl,
      );
    }
  }
}
