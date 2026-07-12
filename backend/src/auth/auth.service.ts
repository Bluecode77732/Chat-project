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
    // Inject the TypeORM repository for User Entity to use in DB.
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  parseBasicToken(rawToken: string) {
    // 1. Splits token by basic and token. Regex(/\s+/) inserted for clearer space.
    // ['Basic', token]
    const basicToken = rawToken.split(' ');

    // 2. If the token length `[Basic token]` isn't 2, throw `BadRequestException` since it's wrong approach for parsing token.
    if (basicToken.length !== 2) {
      logger.warn('Bad Token Format: invalid token segment count');
      throw new BadRequestException('Bad Token Format.');
    }

    // 3. Extracts and sort out by basic and token from the splitted rawToken once again.
    const [basic, token] = basicToken;

    // 4. Verifies the token.
    if (basic.toLowerCase() !== 'basic') {
      logger.warn('Bad Token Format: missing Basic prefix');
      throw new BadRequestException('Bad Token Format.');
    }

    // 5. Decodes extracted raw token from HTTP headers, then convert into readable code.
    const decoded = Buffer.from(token, 'base64').toString('utf-8');

    // 6. Split the decoded token by email and password.
    const tokenSplit = decoded.split(':');

    // 7. Verifies if the token includes basic.
    if (!(tokenSplit.length == 2)) {
      logger.warn(
        'Bad Token Format: decoded token missing email:password structure',
      );
      throw new BadRequestException('Bad Token Format.');
    }

    // 8. Extract email and password for returning to client.
    const [email, password] = tokenSplit;

    logger.debug(`User '${email}' parsed a basic token`);

    // 9. Return result.
    return {
      email,
      password,
    };
  }

  async register(rawToken: string, nickname?: string) {
    // Extracts email and password from basic token
    const { email, password } = this.parseBasicToken(rawToken);

    // Finds user by email
    const user = await this.userRepository.findOne({
      where: {
        email,
      },
    });

    // Verifies if user exist or not
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

    // Hashing the password by bcrypt in secret hashing rounds
    const hash = await bcrypt.hash(
      password,
      this.configService.getOrThrow<number>('HASH_ROUNDS'),
    );

    // Stores user email and hashed password by TypeORM method
    await this.userRepository.save({
      email,
      password: hash,
      role: UserRole.user,
      nickname,
    });

    logger.info(`User '${email}' is registered`);

    // Finds user's email returning to client by TypeORM method
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
    // Bring refreshToken and accessToken to issue token for creating user accessing validation.
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

    // A freshly issued refresh token becomes the only valid one for this user —
    // recording its id here lets a later login (e.g. from another browser)
    // supersede this one; `parseBearerToken` checks against it on refresh.
    const jti = isRefreshToken ? randomUUID() : undefined;
    if (jti) {
      await this.redis.set(`auth:session:${user.id}`, jti, 'EX', expiresIn);
    }

    logger.debug(`User '${user.id}' issued refresh and access tokens`);

    // Since Nodejs single thread feature cannot process another request synchronously as the event loop gets blocked, creating JWT token asynchronously enhances the throughput getting other requests.
    return await this.jwtService.signAsync(
      {
        sub: user.id,
        type: isRefreshToken ? 'refresh' : 'access',
        role: user.role,
        ...(jti ? { jti } : {}),
      },
      // `JwtSignOptions` Can also be set in `auth.module.ts` file, since it requires separated tokens, the options should be set manually.
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
    // This try/catch throws an unified error as JWT throws various error types
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

    // Kept outside the try/catch above so distinct messages reach the client
    // instead of being flattened into the generic 'Token Expired'.
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
    // Extracts email and password
    const { email, password } = this.parseBasicToken(rawToken);

    // Authenticates email and password
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
    // Auth-level ban gate: a banned user must not be able to mint a fresh access token,
    // otherwise the client's silent-refresh retry would loop against jwt.strategy's ban check.
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
    // Get the bearer token
    const payload = await this.parseBearerToken(rawToken, false);

    // Time-To-Live for the bearer token
    const ttl = payload.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      // Blacklist implementation
      await this.redis.set(
        `blacklist:${rawToken.split(' ')[1]}`,
        '1',
        'EX',
        ttl,
      );
    }
  }
}
