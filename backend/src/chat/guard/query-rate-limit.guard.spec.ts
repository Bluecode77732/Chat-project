import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import Redis from 'ioredis';
import { QueryRateLimitGuard } from './query-rate-limit.guard';
import { logger } from 'src/base/logger/logger';

jest.mock('src/base/logger/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

describe('QueryRateLimitGuard', () => {
  let guard: QueryRateLimitGuard;
  let mockRedis: { eval: jest.Mock };
  let req: { user?: { id?: number } };

  const mockExecutionContext: Partial<ExecutionContext> = {};

  beforeEach(() => {
    mockRedis = { eval: jest.fn() };
    req = { user: { id: 1 } };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
    } as unknown as GqlExecutionContext);
    guard = new QueryRateLimitGuard(mockRedis as unknown as Redis);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws UNAUTHORIZED when req.user.id is missing', async () => {
    req = {};

    await expect(
      guard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
  });

  it('allows the request when the count is within budget', async () => {
    mockRedis.eval.mockResolvedValue(1);

    await expect(
      guard.canActivate(mockExecutionContext as ExecutionContext),
    ).resolves.toBe(true);
    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'chat:query_rate_limit:1',
    );
  });

  it('throws TOO_MANY_REQUESTS once the count exceeds the 30/15s budget', async () => {
    mockRedis.eval.mockResolvedValue(31);

    await expect(
      guard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(jest.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('[user=1]'),
    );
  });

  it('re-throws an HttpException raised inside the try block as-is (e.g. the 429 above)', async () => {
    mockRedis.eval.mockResolvedValue(31);

    try {
      await guard.canActivate(mockExecutionContext as ExecutionContext);
      fail('expected canActivate to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
    }
  });

  it('fails open (returns true) and logs when Redis errors unexpectedly', async () => {
    mockRedis.eval.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      guard.canActivate(mockExecutionContext as ExecutionContext),
    ).resolves.toBe(true);
    expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
      expect.stringContaining('[user=1]'),
    );
    expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
      expect.stringContaining('failing open'),
    );
  });
});
