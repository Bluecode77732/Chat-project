import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { PubSubService } from './pubsub.service';
import { SessionCacheService } from 'src/redis/redis.service';

jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn(),
  }));
  return { Redis: RedisMock, default: RedisMock };
});

jest.mock('src/base/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('PubSubService', () => {
  let pubSubService: PubSubService;

  const mockSessionCacheService = {
    cacheMessage: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('redis://localhost:6379'),
  };

  let superPublishSpy: jest.SpyInstance;

  beforeEach(async () => {
    superPublishSpy = jest
      .spyOn(RedisPubSub.prototype, 'publish')
      .mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PubSubService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SessionCacheService, useValue: mockSessionCacheService },
      ],
    }).compile();

    pubSubService = module.get<PubSubService>(PubSubService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(pubSubService).toBeDefined();
  });

  it('should always delegate to the base publish implementation', async () => {
    await pubSubService.publish('receiveMessage :16', {
      receiveMessage: { id: 1, message: 'hi' },
    });

    expect(superPublishSpy).toHaveBeenCalledWith('receiveMessage :16', {
      receiveMessage: { id: 1, message: 'hi' },
    });
  });

  it('should cache the message when the trigger matches receiveMessage :{roomId}', async () => {
    const payload = {
      receiveMessage: { id: 5, message: 'hello', created: new Date() },
    };

    await pubSubService.publish('receiveMessage :16', payload);

    expect(mockSessionCacheService.cacheMessage).toHaveBeenCalledWith(
      16,
      payload.receiveMessage,
    );
  });

  it('should not cache when the trigger does not match the receiveMessage pattern', async () => {
    await pubSubService.publish('someOtherEvent', { foo: 'bar' });

    expect(mockSessionCacheService.cacheMessage).not.toHaveBeenCalled();
  });

  it('should not cache when the payload has no receiveMessage field', async () => {
    await pubSubService.publish('receiveMessage :16', { somethingElse: true });

    expect(mockSessionCacheService.cacheMessage).not.toHaveBeenCalled();
  });

  it('should swallow cacheMessage errors without rejecting publish', async () => {
    mockSessionCacheService.cacheMessage.mockRejectedValueOnce(
      new Error('redis down'),
    );

    await expect(
      pubSubService.publish('receiveMessage :16', {
        receiveMessage: { id: 1, message: 'hi' },
      }),
    ).resolves.toBeUndefined();
  });

  it('cached payload without a created field round-trips to an Invalid Date via SessionCacheService', async () => {
    // Documents the exact defect: AiService previously published a plainToClass'd
    // entity whose @Exclude()-decorated `created` field was stripped before reaching
    // this cache write.
    const payloadMissingCreated = {
      receiveMessage: { id: 7, message: 'no date' },
    };

    await pubSubService.publish('receiveMessage :16', payloadMissingCreated);

    const [, cachedPayload] = mockSessionCacheService.cacheMessage.mock
      .calls[0] as [number, { created?: unknown }];
    expect(cachedPayload.created).toBeUndefined();
  });
});
