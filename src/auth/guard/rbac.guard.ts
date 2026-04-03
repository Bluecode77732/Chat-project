import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../role/role";
import { RBAC } from "../decorator/rbac.decorator";

@Injectable()
export class RBACguard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ) { };

    // It activates when request is allowed
    canActivate(context: ExecutionContext): boolean {
        // Get Role metadata from route handler using reflector
        // Returns a reference to the handler (method) that will be invoked next in the request pipeline.
        const role = this.reflector.get<UserRole>(RBAC, context.getHandler());

        // Check if the retrieved role has validated enum values as UserRole
        if (!Object.values(UserRole).includes(role)) {
            return true;
        };

        // Switch context to HTTP and extract the request.
        //! (not sure if it's solution) Debug - "Failed to send message: Sender isn't online"
        //* Debug
        // const request = context.switchToWs().getClient();
        // const request = context.switchToWs().getClient<Socket>();
        //* Original 
        const request = context.switchToHttp().getRequest();
        
        // Get the authenticated user from the request in auth router.
        //! (not sure if it's solution) Debug - "Failed to send message: Sender isn't online"
        //* Debug
        // const user = request.data.user;
        //* Original 
        const user = request.user;

        // If an user does not exist in request, deny access.
        if(!user) {
            return false;
        };

        // Define access levels for each role
        const accessLevel = {
            [UserRole.signedIn] : 0,
            [UserRole.signedOut] : 1,
        };

        // Compare user's role level with required role level
        // It means user's role level <= required level, can access smaller or equal than required level
        return accessLevel[user.role] == accessLevel[role];
    };
}
