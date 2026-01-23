import { ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class GraphQLAuthGuard extends AuthGuard('jwt-auth-guard') {
    getRequest(context: ExecutionContext) {
        const GqlCtx = GqlExecutionContext.create(context);
        return GqlCtx.getContext().req;
    };
};
