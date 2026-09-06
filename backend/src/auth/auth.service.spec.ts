import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ModerationStatus } from 'src/moderation/enums/moderation-status.enum';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: Repository<UserEntity>;
  let jwtService: JwtService;

  // mock 처리
  const mockUserEntity: UserEntity = {
    id: 1,
    email: 'test@gmail.com',
    password: 'Test123Password',
    role: 0, // 일반 회원
    chats: [],
    rooms: [],
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockRedis = {
    set: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(async () => {
    // 기본 mock 테스트
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    // 매 테스트 전 모든 mock 초기화
    jest.clearAllMocks();
  });

  describe('parseBasicToken', () => {
    it('should parse valid basic token', () => {
      // email:password를 base64로 인코딩한 토큰 생성
      const token = Buffer.from('test@gmail.com:Test123Password').toString(
        'base64',
      );
      const rawToken = `Basic ${token}`;

      const result = authService.parseBasicToken(rawToken);

      expect(result.email).toBe('test@gmail.com');
      expect(result.password).toBe('Test123Password');
    });

    it('should throw `BadRequestException` for invalid token format', () => {
      const InvalidRawToken = 'InvalidTokenFormat';
      expect(() => authService.parseBasicToken(InvalidRawToken)).toThrow(
        BadRequestException,
      );
    });

    it('should throw an error for invalid basic token format', () => {
      const InvalidRawToken = 'Basic token';
      expect(() => authService.parseBasicToken(InvalidRawToken)).toThrow(
        BadRequestException,
      );
    });

    it('should throw an error for invalid refresh access token format', () => {
      const InvalidBearerToken = 'Bearer token';
      expect(() => authService.parseBasicToken(InvalidBearerToken)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('parseBearerToken', () => {
    it('should parse a bearer token', async () => {
      const rawToken = 'Bearer Token';

      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ type: 'access' });
      jest.spyOn(mockConfigService, 'getOrThrow').mockResolvedValue('secret');

      await authService.parseBearerToken(rawToken, false);
    });

    it('should throw BadRequestException for invalid token format', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ type: 'refresh' });
      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue('secret');

      await expect(
        authService.parseBearerToken('InvalidTokenFormat', false),
      ).rejects.toThrow(new UnauthorizedException('Token Expired'));
    });

    it('should throw BadRequestException for a non-Bearer prefix', async () => {
      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue('secret');

      await expect(
        authService.parseBearerToken('Basic token', false),
      ).rejects.toThrow(new UnauthorizedException('Token Expired'));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jest.mocked(jwtService.verifyAsync)).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for not a refresh token', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ type: 'refresh' });
      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue('secret');

      await expect(
        authService.parseBearerToken('Bearer validToken', false),
      ).rejects.toThrow(new UnauthorizedException('Token Expired'));
    });

    it('should throw UnauthorizedException when an access token is presented where a refresh token is required', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ type: 'access' });
      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue('secret');

      await expect(
        authService.parseBearerToken('Bearer accessToken', true),
      ).rejects.toThrow(new UnauthorizedException('Token Expired'));
    });

    it('should throw "Session Superseded" when a newer refresh token has been issued', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        type: 'refresh',
        sub: 1,
        jti: 'old-jti',
      });
      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue('secret');
      mockRedis.get.mockResolvedValue('new-jti');

      await expect(
        authService.parseBearerToken('Bearer refreshToken', true),
      ).rejects.toThrow(new UnauthorizedException('Session Superseded'));
    });

    it('should accept a refresh token matching the current session', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        type: 'refresh',
        sub: 1,
        jti: 'current-jti',
      });
      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue('secret');
      mockRedis.get.mockResolvedValue('current-jti');

      const result = await authService.parseBearerToken(
        'Bearer refreshToken',
        true,
      );
      expect(result.jti).toBe('current-jti');
    });

    it('should throw UnauthorizedException for a blacklisted access token', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ type: 'access', sub: 1 });
      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue('secret');
      mockRedis.get.mockResolvedValue('1');

      await expect(
        authService.parseBearerToken('Bearer revokedToken', false),
      ).rejects.toThrow(new UnauthorizedException('Token has been revoked.'));
    });

    it('should pass when access token is not blacklisted', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ type: 'access', sub: 1 });
      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue('secret');
      mockRedis.get.mockResolvedValue(null);

      const result = await authService.parseBearerToken(
        'Bearer validToken',
        false,
      );
      expect(result.type).toBe('access');
    });
  });

  describe('register', () => {
    // Base64 인증 디코딩 포맷 => email:password => base64로 변환
    const token = Buffer.from('test@gmail.com:Test123Password').toString(
      'base64',
    );
    const BasicToken = `Basic ${token}`;
    const hashRounds = 10;
    const email = 'test@gmail.com';
    const password = 'Test123Password';
    const hashedPassword = 'HashedPassword';

    //* jest-mock@30 + Node 24 환경 제약으로 bcrypt는 jest.spyOn으로 테스트 불가 — mock 직접 대입함
    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    it('should register a new user', async () => {
      // user의 findOne이 값을 resolve하도록 mock 처리
      mockUserRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          email: 'test@gmail.com',
          password: hashedPassword,
        });
      // user의 save가 값을 resolve하도록 mock 처리
      mockUserRepository.save.mockResolvedValueOnce({
        email: 'test@gmail.com',
        password: 'Test123Password',
      });
      // ConfigService의 getOrThrow가 값을 반환하도록 mock 처리
      mockConfigService.getOrThrow.mockReturnValue(hashRounds);

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await authService.register(BasicToken);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, hashRounds);
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@gmail.com' },
      });
      expect(result).toEqual({ email, password: hashedPassword });
    });

    it('should throw `BadRequestException` when user already Exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUserEntity);

      await expect(authService.register(BasicToken)).rejects.toThrow(
        new BadRequestException('User Already Exist.'),
      );

      // save가 호출되지 않았는지 확인
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw `BadRequestException` when nickname already in use', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // 이메일 조회
        .mockResolvedValueOnce(mockUserEntity); // 닉네임 조회

      await expect(
        authService.register(BasicToken, 'TakenNickname'),
      ).rejects.toThrow(new BadRequestException('Nickname already in use.'));

      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should save the nickname when registering with one', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // 이메일 조회
        .mockResolvedValueOnce(null) // 닉네임 조회
        .mockResolvedValueOnce({
          email: 'test@gmail.com',
          password: hashedPassword,
          nickname: 'Joon',
        });
      mockUserRepository.save.mockResolvedValueOnce({});
      mockConfigService.getOrThrow.mockReturnValue(hashRounds);

      await authService.register(BasicToken, 'Joon');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ nickname: 'Joon' }),
      );
    });
  });

  describe('validateUser', () => {
    const email = 'test@gmail.com';
    const password = '#Test@123$Password!';
    const user = {
      email,
      password: 'Hashed@123!Password',
    };

    it('should validate user', async () => {
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser(email, password);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jest.mocked(userRepository.findOne)).toHaveBeenCalledWith({
        where: { email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        password,
        'Hashed@123!Password',
      );
      expect(result).toEqual(user);
    });

    it('should throw a BadRequestException for invalid user', async () => {
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);

      await expect(authService.validateUser(email, password)).rejects.toThrow(
        new BadRequestException('Invalid User.'),
      );
    });

    it('should throw a BadRequestException when user password is incorrect', async () => {
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.validateUser(email, password)).rejects.toThrow(
        new BadRequestException('Invalid User.'),
      );
    });

    it('should throw a BadRequestException for an AI system account', async () => {
      jest
        .spyOn(mockUserRepository, 'findOne')
        .mockResolvedValue({ ...user, isAI: true });

      await expect(authService.validateUser(email, password)).rejects.toThrow(
        new BadRequestException('Invalid User.'),
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('issueToken', () => {
    const user = { id: 1 };
    const token = 'token';

    beforeEach(() => {
      jest
        .spyOn(mockConfigService, 'getOrThrow')
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(10);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);
    });

    it('should issue an refresh token', async () => {
      const result = await authService.issueToken({ id: 1, role: 0 }, true);

      // JWT 디코딩된 payload
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jest.mocked(jwtService.signAsync)).toHaveBeenCalledWith(
        {
          sub: user.id,
          role: 0,
          type: 'refresh',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          jti: expect.any(String),
        },
        { secret: 10, expiresIn: 10 },
      );
      // 새로 발급된 refresh token이 이 유저의 유일한 유효 세션이 됨
      expect(mockRedis.set).toHaveBeenCalledWith(
        'auth:session:1',
        expect.any(String),
        'EX',
        10,
      );
      expect(result).toBe(token);
    });

    it('should issue an access token', async () => {
      const result = await authService.issueToken({ id: 1, role: 0 }, false);

      // JWT 디코딩된 payload들
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jest.mocked(jwtService.signAsync)).toHaveBeenCalledWith(
        { sub: user.id, role: 0, type: 'access' },
        { secret: 10, expiresIn: 10 },
      );
      expect(result).toBe(token);
    });
  });

  describe('signIn', () => {
    const rawToken = 'Basic token';
    const email = 'test@gmail.com';
    const password = '#Test@123$Password!';
    const user = {
      id: 1,
    };

    it('should sign in a user', async () => {
      jest
        .spyOn(authService, 'parseBasicToken')
        .mockReturnValue({ email, password });
      jest.spyOn(authService, 'validateUser').mockResolvedValue(user);
      jest.spyOn(authService, 'issueToken').mockResolvedValue('token');

      const result = await authService.signIn(rawToken);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jest.mocked(authService.parseBasicToken)).toHaveBeenCalledWith(
        rawToken,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jest.mocked(authService.validateUser)).toHaveBeenCalledWith(
        email,
        password,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jest.mocked(authService.issueToken)).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        refreshToken: 'token',
        accessToken: 'token',
      });
    });
  });

  describe('refreshAccessToken', () => {
    const rawToken = 'Bearer refreshToken';

    it('should issue a fresh access token for an active user', async () => {
      jest
        .spyOn(authService, 'parseBearerToken')
        .mockResolvedValue({ sub: 1 } as any);
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue({
        id: 1,
        role: 0,
        status: ModerationStatus.active,
      });
      jest.spyOn(authService, 'issueToken').mockResolvedValue('newAccessToken');

      const result = await authService.refreshAccessToken(rawToken);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jest.mocked(authService.parseBearerToken)).toHaveBeenCalledWith(
        rawToken,
        true,
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jest.mocked(authService.issueToken)).toHaveBeenCalledWith(
        { id: 1, role: 0 },
        false,
      );
      expect(result).toEqual({ accessToken: 'newAccessToken' });
    });

    it('should throw UnauthorizedException when the user no longer exists', async () => {
      jest
        .spyOn(authService, 'parseBearerToken')
        .mockResolvedValue({ sub: 1 } as any);
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);

      await expect(authService.refreshAccessToken(rawToken)).rejects.toThrow(
        new UnauthorizedException('User Not Found.'),
      );
    });

    it('should throw UnauthorizedException when the user is currently banned', async () => {
      jest
        .spyOn(authService, 'parseBearerToken')
        .mockResolvedValue({ sub: 1 } as any);
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue({
        id: 1,
        role: 0,
        status: ModerationStatus.banned,
        bannedUntil: null,
      });

      await expect(authService.refreshAccessToken(rawToken)).rejects.toThrow(
        new UnauthorizedException('Account Suspended'),
      );
    });
  });

  describe('signOut', () => {
    it('should blacklist the access token for its remaining TTL', async () => {
      const exp = Math.floor(Date.now() / 1000) + 60;
      jest.spyOn(authService, 'parseBearerToken').mockResolvedValue({
        exp,
        iat: 0,
      } as any);

      await authService.signOut('Bearer accessToken');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'blacklist:accessToken',
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('should not blacklist an already-expired token', async () => {
      const exp = Math.floor(Date.now() / 1000) - 60;
      jest.spyOn(authService, 'parseBearerToken').mockResolvedValue({
        exp,
        iat: 0,
      } as any);

      await authService.signOut('Bearer accessToken');

      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });
});
