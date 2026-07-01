import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { Socket } from 'socket.io';

export const WebSocketQueryRunner = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const client = ctx.switchToWs().getClient<Socket>();
    // socket.data is typed as any by socket.io; we narrow it to the shape we set in the interceptor
    const clientData = client.data as { queryRunner?: QueryRunner };

    if (!clientData.queryRunner) {
      throw new InternalServerErrorException('Cannot find QueryRunner.');
    }

    return clientData.queryRunner;
  },
);
