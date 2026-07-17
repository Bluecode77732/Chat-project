# 0017: AuthModule ↔ UserModule ↔ ChatModule circular dependency via forwardRef

## Status

Accepted

## Context

Three independent, single-direction dependencies happen to chain into a closed loop:

- **`AuthModule → UserModule`**: `JwtStrategy` (provided by `AuthModule`) calls
  `userService.findOne(payload.sub)` on a `user_cache` miss (`jwt.strategy.ts:17,59`).
  `AuthService` itself does not depend on `UserService` — it reads `UserEntity` via its own injected
  repository.
- **`UserModule → ChatModule`**: `UserService` calls `chatService.disconnectSocket()` from `forceLogout`
  (`user.service.ts:43,320`) and from the cascade-cleanup path in `remove` (`user.service.ts:416`).
- **`ChatModule → AuthModule`**: `ChatGateway.handleConnection()` calls `authService.parseBearerToken()`
  to authenticate the WebSocket handshake, which doesn't go through the standard HTTP Guard pipeline
  (`chat.gateway.ts:10,47,90`).

Each edge is one-directional — no pair of these three modules imports the other back — so this is not
a mutual/bidirectional coupling like the one `ModerationModule` deliberately avoided by using callback
injection instead of importing `ChatModule` directly (see [ADR 0006](0006-moderation-one-directional-dependency.md)).
It is a directed chain (`Auth → User → Chat → Auth`) across three distinct domains, each with its own
independently justified reason to depend on the next. Without `forwardRef` on one edge, NestJS cannot
resolve the module graph at bootstrap: to construct `AuthModule` it needs `UserModule`, which needs
`ChatModule`, which needs `AuthModule` again, with no module fully defined first.

## Decision

`AuthModule` imports `UserModule` via `forwardRef(() => UserModule)` (`auth.module.ts`) — NestJS's
officially supported mechanism for exactly this situation. `forwardRef` does not remove the cycle or
change which module depends on which; it only defers resolution of that one edge until all modules have
been registered, turning a bootstrap failure into a successful (if lazily-wired) boot. The cycle's shape
is identical with or without `forwardRef` — only the timing of resolving the `Auth → User` edge changes.

Full removal of the cycle is possible but not equally cheap across the three edges:

- `Auth → User` is the cheapest to remove: `JwtStrategy` could read `UserEntity` via a directly injected
  repository instead of `UserService`, the same way `AuthService` already does — no new pattern needed.
- `Chat → Auth` is moderately cheap: `parseBearerToken` could be extracted into a dependency-free
  utility shared by both modules instead of living on `AuthService`.
- `User → Chat` is the expensive one: `ModerationModule`'s callback-injection pattern works because
  `ChatResolver` calls `ModerationService` at message-handling time and can hand over a callback in the
  same call. `forceLogout`/`remove` are invoked from `UserController` (a plain REST admin action) with
  no equivalent per-call context to carry a callback through — decoupling this edge would require
  introducing an event-emitter pattern not currently used anywhere in this codebase, which is an
  architectural change, not a local refactor.

Given the low severity (a bootstrap-order mechanic, not a runtime bug, security issue, or data-integrity
issue — see Never Do Groups 1–3, none of which this touches) and the cost of fully removing the most
expensive edge, no refactor was undertaken; the cycle is accepted as-is.

## Consequences

- Never suggest deleting `forwardRef(() => UserModule)` from `AuthModule` without also removing at least
  one of the three edges — doing so reintroduces the exact bootstrap failure `forwardRef` exists to
  avoid.
- A future request to fully decouple this cycle should be scoped as three separate changes with
  different costs (see Decision above), not one refactor — and the `User → Chat` edge specifically
  requires introducing a new architectural pattern (event emitter), which needs explicit approval per
  Scope Discipline, not an incidental fix.
- This is not a template for new circular dependencies: the reason this one is acceptable is that all
  three edges are independently one-directional across genuinely distinct domains (auth, account
  management, realtime connections). A new dependency that would make two modules mutually/bidirectionally
  coupled over the *same* feature domain should still default to `ModerationModule`'s callback-injection
  pattern (ADR 0006), not to `forwardRef`.
