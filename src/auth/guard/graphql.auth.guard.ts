import { ExecutionContext, Injectable } from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class GraphQLAuthGuard extends AuthGuard('jwt-auth-guard') {
    getRequest(context: ExecutionContext) {
        const GqlCtx = GqlExecutionContext.create(context);
        const ctx = GqlCtx.getContext()
        //! Debug - Solving on 'Cannot Find Sender ID': `|| 1`
        const req = ctx.req || { headers: { authorization: ctx.authorization } } || 1;

        // Flow logging
        // console.log('GraphQL Context:', ctx);
        // console.log('Request object:', req);
        // console.log('Authorization header:', req?.headers?.authorization);

        return req;
    };
};
