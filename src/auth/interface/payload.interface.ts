import { UserRole } from "../role/role";

// Minimal JWT payload interface.
export interface Payload {
    // User ID for lookup.
    sub: number,

    // Distinguish access/refresh tokens
    type: "refresh" | "access",

    // Distinguish Authorization Level
    role: UserRole.admin | UserRole.participant,

    // JWT library handles automatically the `iat/exp` dates.
};
