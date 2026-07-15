# 0001: JWT access/refresh token split

## Status

Accepted

## Context

The app needs stateless auth that works across both a REST surface and GraphQL (queries, mutations,
subscriptions) and a Socket.IO connection, without forcing a session store lookup on every request.

## Decision

- `accessToken`: 15-minute lifetime, kept in memory only on the frontend (Zustand store) — never
  written to `localStorage` or a cookie.
- `refreshToken`: 7-day lifetime, stored in an httpOnly cookie set by the backend at sign-in
  (`secure: true`, `sameSite: 'none'`).
- Guard order is composed, not subclassed: `JwtAuthGuard` → `RbacGuard` → handler (REST), and the
  GraphQL equivalent `GraphQLAuthGuard` → `GraphQLRBACGuard` (`chat.resolver.ts`).
- WebSocket auth is validated in `handleConnection` via `client.handshake.headers.authorization`
  (Bearer token in the Socket.IO handshake header) — there is no separate WS-specific auth mechanism.
- Sign-out (`POST /auth/signOut`) has the backend call `res.clearCookie('refreshToken')` server-side;
  the frontend clears its Zustand store and redirects.
- All silent refreshes go through one function, `refreshAccessTokenSafely()`
  (`frontend/src/auth/session-guard.ts`) — concurrent callers share one in-flight request, closing a
  race where a second caller could adopt a conflicting account mid-redirect.

## Consequences

- Never suggest REST-only auth, session-based auth, or storing `accessToken` in `localStorage` — these
  reopen the XSS/CSRF tradeoffs this split was chosen to avoid.
- Any new call site that needs a fresh `accessToken` must call `refreshAccessTokenSafely()` rather than
  hitting `/auth/token/refreshaccess` directly, or the shared-refresh race protection is bypassed.
- Any new role-gated guard must be composed with `JwtAuthGuard`/`GraphQLAuthGuard`, never built as a
  subclass that strengthens the parent guard's precondition (an LSP violation this project has already
  removed once — see the former `GraphQLAdminGuard extends GraphQLAuthGuard`, now replaced by
  `@RBAC(UserRole.admin)` + composed guards in `chat.resolver.ts`).
