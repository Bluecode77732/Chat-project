import { createParamDecorator, ExecutionContext, InternalServerErrorException } from "@nestjs/common";

export const QueryRunnerDecorator = createParamDecorator(
    (data: string, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();

        if (!request || !request.queryRunner) {
            throw new InternalServerErrorException("Cannot find QueryRunner.")
        };

        return request.queryRunner;
    },
);
