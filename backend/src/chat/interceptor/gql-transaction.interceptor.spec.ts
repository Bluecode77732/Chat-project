import {
  CallHandler,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { DataSource, QueryRunner } from 'typeorm';
import { firstValueFrom, of, throwError } from 'rxjs';
import { GqlTransactionInterceptor } from './gql-transaction.interceptor';
import { logger } from 'src/base/logger/logger';

jest.mock('src/base/logger/logger', () => ({
  logger: { error: jest.fn() },
}));

interface FakeGqlRequest {
  user?: { id?: number };
  queryRunner?: QueryRunner;
  transactionCommitted?: Promise<void>;
}

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('GqlTransactionInterceptor', () => {
  let interceptor: GqlTransactionInterceptor;
  let mockQueryRunner: Partial<QueryRunner>;
  let mockDataSource: Partial<DataSource>;
  let req: FakeGqlRequest;

  const successHandler: CallHandler<unknown> = { handle: () => of({ id: 1 }) };
  const errorHandler: CallHandler<unknown> = {
    handle: () => throwError(() => new Error('boom')),
  };

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      isReleased: false,
    };
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };
    req = {};
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
    } as unknown as GqlExecutionContext);
    interceptor = new GqlTransactionInterceptor(mockDataSource as DataSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockExecutionContext: Partial<ExecutionContext> = {};

  describe('success path', () => {
    it('connects and starts a transaction before next.handle() is invoked, and attaches queryRunner to req', async () => {
      await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        successHandler,
      );

      expect(mockQueryRunner.connect).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalledTimes(1);
      expect(req.queryRunner).toBe(mockQueryRunner);
    });

    it('sets req.transactionCommitted to a Promise before next.handle() is invoked', async () => {
      await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        successHandler,
      );

      expect(req.transactionCommitted).toBeInstanceOf(Promise);
    });

    it('does not emit the result until commitTransaction has actually resolved (regression for f4bb908 floating-promise bug)', async () => {
      const order: string[] = [];
      const commitDeferred = createDeferred<void>();
      mockQueryRunner.commitTransaction = jest.fn().mockImplementation(() => {
        order.push('commit-called');
        return commitDeferred.promise.then(() => {
          order.push('commit-resolved');
        });
      });

      const observable = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        successHandler,
      );

      let settled = false;
      const pending = firstValueFrom(observable).then((value) => {
        settled = true;
        return value;
      });

      // Flush pending microtasks without advancing wall-clock time or using fake timers.
      await new Promise((resolve) => setImmediate(resolve));

      expect(settled).toBe(false);
      expect(order).toEqual(['commit-called']);

      commitDeferred.resolve();
      await pending;

      expect(settled).toBe(true);
      expect(order).toEqual(['commit-called', 'commit-resolved']);
    });

    it('does not resolve transactionCommitted until commitTransaction has resolved, and releases exactly once', async () => {
      const commitDeferred = createDeferred<void>();
      mockQueryRunner.commitTransaction = jest
        .fn()
        .mockImplementation(() => commitDeferred.promise);

      const observable = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        successHandler,
      );
      const pending = firstValueFrom(observable);

      let committedSignalFired = false;
      void req.transactionCommitted?.then(() => {
        committedSignalFired = true;
      });

      // Flush pending microtasks without resolving the commit yet.
      await new Promise((resolve) => setImmediate(resolve));
      expect(committedSignalFired).toBe(false);

      commitDeferred.resolve();
      await pending;

      expect(committedSignalFired).toBe(true);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('error path (next.handle() emits an error)', () => {
    it('rolls back, releases exactly once, and rejects with InternalServerErrorException', async () => {
      const observable = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        errorHandler,
      );

      await expect(firstValueFrom(observable)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('logs the original error message with the user id when req.user is present', async () => {
      req.user = { id: 42 };
      const observable = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        errorHandler,
      );

      await expect(firstValueFrom(observable)).rejects.toThrow();

      expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining('[user=42]'),
      );
    });

    it('logs "unknown" as the user id when req.user is undefined', async () => {
      const observable = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        errorHandler,
      );

      await expect(firstValueFrom(observable)).rejects.toThrow();

      expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining('[user=unknown]'),
      );
    });
  });

  describe('releaseOnce idempotency', () => {
    it('does not call release at all when queryRunner.isReleased is already true', async () => {
      mockQueryRunner = { ...mockQueryRunner, isReleased: true };
      (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
        mockQueryRunner,
      );
      interceptor = new GqlTransactionInterceptor(mockDataSource as DataSource);

      const observable = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        successHandler,
      );
      await firstValueFrom(observable);

      expect(mockQueryRunner.release).not.toHaveBeenCalled();
    });
  });

  describe('commitTransaction itself throwing', () => {
    it('rolls back, releases exactly once, and rejects with the generic InternalServerErrorException — not the raw commit error', async () => {
      mockQueryRunner.commitTransaction = jest
        .fn()
        .mockRejectedValue(new Error('commit failed'));

      const observable = await interceptor.intercept(
        mockExecutionContext as ExecutionContext,
        successHandler,
      );

      await expect(firstValueFrom(observable)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);

      expect(jest.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining('commit failed'),
      );
    });
  });
});
