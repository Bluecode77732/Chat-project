import { UserRole } from '../role/role';

// Minimal JWT payload interface.
export interface Payload {
  // User ID for lookup.
  sub: number;

  // Distinguish access/refresh tokens
  type: 'refresh' | 'access';

  // Distinguish Authorization Level
  role: UserRole;

  // Unique id of the issued refresh token, used to detect a newer login
  // superseding this one. Only present on refresh tokens.
  jti?: string;

  // JWT library handles automatically the `iat/exp` dates.
}
