// Purpose: exposes the QueryRunner opened by GqlTransactionInterceptor to a resolver parameter.
// Usage: imported by ChatResolver.sendMessage(); paired 1:1 with GqlTransactionInterceptor.
// Rationale: GraphQL has no request-object equivalent resolvers can read directly, so the
// interceptor and this decorator share state via GqlExecutionContext's context.req.

import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { QueryRunner } from 'typeorm';

export const GqlQueryRunnerDecorator = createParamDecorator(
  (data: unknown, context: ExecutionContext): QueryRunner => {
    const ctx = GqlExecutionContext.create(context).getContext<{
      req?: { queryRunner?: QueryRunner };
    }>();

    if (!ctx.req?.queryRunner) {
      throw new InternalServerErrorException('Cannot find QueryRunner.');
    }

    return ctx.req.queryRunner;
  },
);
