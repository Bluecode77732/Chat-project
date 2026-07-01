import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';

export const QueryRunnerDecorator = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ queryRunner?: QueryRunner }>();

    if (!request?.queryRunner) {
      throw new InternalServerErrorException('Cannot find QueryRunner.');
    }

    return request.queryRunner;
  },
);
