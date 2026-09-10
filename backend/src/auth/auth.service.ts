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
    // DB에서 사용할 User Entity의 TypeORM 리포지토리를 주입.
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

    // 2. 분리된 토큰 길이가 `[Basic token]` 형태인 2가 아니면 파싱 방식이 잘못된 것이므로 `BadRequestException`을 던짐.
    if (basicToken.length !== 2) {
      logger.warn('Bad Token Format: invalid token segment count');
      throw new BadRequestException('Bad Token Format.');
    }

    // 3. 분리된 rawToken에서 basic과 token을 다시 한번 추출해 정리.
    const [basic, token] = basicToken;

    // 4. 토큰을 검증.
    if (basic.toLowerCase() !== 'basic') {
      logger.warn('Bad Token Format: missing Basic prefix');
      throw new BadRequestException('Bad Token Format.');
    }

    // 5. HTTP 헤더에서 추출한 raw token을 디코딩해 읽을 수 있는 값으로 변환.
    const decoded = Buffer.from(token, 'base64').toString('utf-8');

    // 6. 디코딩된 토큰을 email과 password로 분리.
    const tokenSplit = decoded.split(':');

    // 7. 토큰에 basic이 포함되어 있는지 검증.
    if (!(tokenSplit.length == 2)) {
      logger.warn(
        'Bad Token Format: decoded token missing email:password structure',
      );
      throw new BadRequestException('Bad Token Format.');
    }

    // 8. 클라이언트에 반환할 email과 password를 추출.
    const [email, password] = tokenSplit;

    logger.debug(`User '${email}' parsed a basic token`);

    // 9. 결과를 반환.
    return {
      email,
      password,
    };
  }

  async register(rawToken: string, nickname?: string) {
    // basic token에서 email과 password를 추출
    const { email, password } = this.parseBasicToken(rawToken);

    // email로 사용자를 조회
    const user = await this.userRepository.findOne({
      where: {
        email,
      },
    });

    // 사용자가 이미 존재하는지 확인
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

    // bcrypt로 지정된 해싱 라운드만큼 비밀번호를 해싱
    const hash = await bcrypt.hash(
      password,
      this.configService.getOrThrow<number>('HASH_ROUNDS'),
    );

    // TypeORM으로 사용자 email과 해싱된 password를 저장
    await this.userRepository.save({
      email,
      password: hash,
      role: UserRole.user,
      nickname,
    });

    logger.info(`User '${email}' is registered`);

    // TypeORM으로 클라이언트에 반환할 사용자 email을 조회
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
    // 사용자 접근 검증용 토큰 발급을 위해 refreshToken과 accessToken을 가져옴.
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

    // Node.js는 싱글 스레드라 동기 처리 시 이벤트 루프가 블로킹되므로, JWT 토큰을 비동기로 생성해 다른 요청 처리량을 높임.
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
    // email과 password를 추출
    const { email, password } = this.parseBasicToken(rawToken);

    // email과 password를 인증
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
    // bearer token을 가져옴
    const payload = await this.parseBearerToken(rawToken, false);

    // bearer token의 TTL(Time-To-Live)
    const ttl = payload.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      // 블랙리스트 처리
      await this.redis.set(
        `blacklist:${rawToken.split(' ')[1]}`,
        '1',
        'EX',
        ttl,
      );
    }
  }
}
