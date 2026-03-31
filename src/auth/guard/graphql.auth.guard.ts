import { ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class GraphQLAuthGuard extends AuthGuard('jwt-auth-guard') {
    getRequest(context: ExecutionContext) {
        const GqlCtx = GqlExecutionContext.create(context);
        const ctx = GqlCtx.getContext()
        //! Debug - Solving on 'Cannot Find Sender ID': Seems jwt strategy passport cannot populates `req.user`, so GraphQL context cannot find sender id.
        const req = ctx.req || { headers: { authorization: ctx.authorization } };

        return req;
    };
};
