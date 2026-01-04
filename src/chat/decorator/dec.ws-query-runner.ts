import { createParamDecorator, ExecutionContext, InternalServerErrorException } from "@nestjs/common";

export const WebSocketQueryRunner = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const client = ctx.switchToWs().getClient();

        if (!client || !client.data || !client.data.queryRunner) {
            throw new InternalServerErrorException("Cannot find QueryRunner.")
        };

        return client.data.queryRunner;
    },
);
