// 목적: GqlTransactionInterceptor가 연 QueryRunner를 resolver 파라미터로 노출.
// 사용처: ChatResolver.sendMessage()에서 import; GqlTransactionInterceptor와 1:1로 짝을 이룸.
// 근거: GraphQL에는 resolver가 직접 읽을 수 있는 request 객체 동등물이 없어서,
// interceptor와 이 decorator가 GqlExecutionContext의 context.req를 통해 상태를 공유.

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
