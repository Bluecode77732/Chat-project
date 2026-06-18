import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: Repository<UserEntity>;
  let configService: ConfigService;
  let jwtService: JwtService;

  // Mocking
  const mockUserEntity: UserEntity = {
    id: 1,
    email: 'test@gmail.com',
    password: 'Test123Password',
    role: 0, //Signed In
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

  beforeEach(async () => {
    // Testing basic mocks
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
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
    configService = module.get<ConfigService>(ConfigService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('parseBasicToken', () => {
    it('should parse valid basic token', () => {
      // Create base64 encoded token => email:password
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
      // const payload = { type: 'access' };

      // jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ type: 'access' });
      jest.spyOn(mockConfigService, 'getOrThrow').mockResolvedValue('secret');

      // const result = await authService.parseBearerToken(rawToken, false);
      await authService.parseBearerToken(rawToken, false);

      // expect(result).toEqual(payload);
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

    it('should throw BadRequestException for not a bearer token', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ type: 'refresh' });
      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue('secret');

      await expect(
        authService.parseBearerToken('bEaReR token', false),
      ).rejects.toThrow(
        new UnauthorizedException(new UnauthorizedException('Token Expired')),
      );
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
  });

  describe('register', () => {
    // Base64 authentication decoded format => email:password => convert into base64 readable string
    const token = Buffer.from('test@gmail.com:Test123Password').toString(
      'base64',
    );
    const BasicToken = `Basic ${token}`;
    const hashRounds = 10;
    const email = 'test@gmail.com';
    const password = 'Test123Password';
    const hashedPassword = 'HashedPassword';

    //* Since jest.spyOn cannot test out `bcrypt` as jest-mock@30 + Node 24 is restricted environment.
    beforeEach(() => {
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    it('should register a new user', async () => {
      // Mocking user's findOne to resolve value
      mockUserRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          email: 'test@gmail.com',
          password: hashedPassword,
        });
      // Mocking user's save to resolve value
      mockUserRepository.save.mockResolvedValueOnce({
        email: 'test@gmail.com',
        password: 'Test123Password',
      });
      // Mocking ConfigService's getOrThrow to return value
      mockConfigService.getOrThrow.mockReturnValue(hashRounds);

      // `bcrypt.compare` is async, thus it returns a `Promise`.
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve(hashedPassword));

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

      // Testing that save wasn't called
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should throw `BadRequestException` when nickname already in use', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(mockUserEntity); // nickname check

      await expect(
        authService.register(BasicToken, 'TakenNickname'),
      ).rejects.toThrow(new BadRequestException('Nickname already in use.'));

      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should save the nickname when registering with one', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(null) // nickname check
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
      // `bcrypt.compare` is async, thus it returns a `Promise`.
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));

      const result = await authService.validateUser(email, password);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email } });
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
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      await expect(authService.validateUser(email, password)).rejects.toThrow(
        new BadRequestException('Invalid User.'),
      );
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

      // Jwt decoded payload
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: user.id, role: 0, type: 'refresh' },
        { secret: 10, expiresIn: 10 },
      );
      expect(result).toBe(token);
    });

    it('should issue an access token', async () => {
      const result = await authService.issueToken({ id: 1, role: 0 }, false);

      // Jwt decoded payloads
      expect(jwtService.signAsync).toHaveBeenCalledWith(
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

      expect(authService.parseBasicToken).toHaveBeenCalledWith(rawToken);
      expect(authService.validateUser).toHaveBeenCalledWith(email, password);
      expect(authService.issueToken).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        refreshToken: 'token',
        accessToken: 'token',
      });
    });
  });
});
