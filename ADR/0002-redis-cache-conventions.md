# 0002: Redis cache key/TTL conventions via ioredis

## Status

Accepted

## Context

The app needs a shared cache/session layer that works identically across multiple backend instances
(horizontal scaling), plus a pub/sub bridge from GraphQL mutations to GraphQL subscriptions, plus a
mechanism to keep Socket.IO room broadcasts consistent across instances.

## Decision

- Client library: `ioredis`, unified across the whole codebase (`redis.module.ts`).
- Key naming convention: `{service}:{entity}:{id}` — e.g. `chat:session:userId`,
  `moderation:strike:{userId}` (`moderation.constants.ts`).
- Every key carries a TTL at write time — no indefinite cache. `user_cache:{userId}`
  (`USER_CACHE_TTL_SEC`, default 300s, set by `jwt.strategy.ts`) is additionally invalidated
  explicitly after `updateRole` (`user.service.ts:290`) — any future path that mutates a user's role
  must call `redis.del(\`user_cache:${userId}\`)` the same way, or it opens a privilege-escalation
  window lasting up to the TTL.
- Pub/sub uses a dedicated subscriber connection, separate from the publisher connection, created
  inline in `graphql/pubsub.service.ts`.
- `@socket.io/redis-adapter` wires `ChatGateway` to Redis (`chat.gateway.ts:64`) so room
  membership/broadcasts work correctly with more than one server instance — without it,
  `server.to(socketId).emit(...)` only reaches clients on the same process.
- Per-resource concurrency guards (e.g. `AiService.handleReply()`'s `ai:lock:{roomId}` lock,
  `SET ... EX 30 NX`, released in a `finally` block) follow the same acquire-with-NX/TTL pattern.

## Consequences

- Never suggest `node-redis` — `ioredis` is the only client used across this codebase; introducing a
  second client (which has in fact already happened accidentally — see the flagged, unused `redis` v5
  dependency noted in [ARCHITECTURE.md](../ARCHITECTURE.md#known-anomaly-flagged-not-fixed)) creates
  confusion about which client is authoritative.
- Any new Redis key must follow the naming convention and carry an explicit TTL; a key without one is a
  Never Do Group 3 violation (unbounded memory growth).
- Any new per-user real-time registration or per-resource background job must apply the same
  invalidation/locking patterns already established here, not assume they're optional because "this one
  case is different."
