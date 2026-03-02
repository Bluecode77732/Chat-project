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
        // const token = ctx.req?.headers?.authorization || 1;
        // console.log(token);

        // const tokenSplit = token.split(' ')[1].split('.')[1];
        // console.log(tokenSplit);
        
        // const payload = JSON.parse(Buffer.from(tokenSplit, 'base64').toString());
        // console.log(payload);
        
        // const userId = payload.sub;
        // console.log(userId);

        // Flow logging
        // console.log('GraphQL Context:', ctx);
        // console.log('Request object:', req);
        // console.log('Authorization header:', req?.headers?.authorization);

        return req;
        // return userId;
    };
};
