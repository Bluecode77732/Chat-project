# 0016: Redis unavailability — fail closed for security checks, degrade to DB for caches

## Status

Accepted

## Context

Redis backs several call sites in the `sendMessage`/auth request path with very different risk
profiles: a rate-limit counter with no DB equivalent, a ban/mute gate with no DB equivalent (mute) or
a DB equivalent that already exists separately (ban), a token-blacklist check with no DB equivalent,
and a `user_cache` read-through cache that sits in front of an existing DB lookup. Before this pass,
error handling on Redis calls was inconsistent and mostly absent: `RateLimitGuard` explicitly caught
Redis errors and denied the request (`rate-limit.guard.ts:70-82`), but `ModerationService.isMuted()`
and both Redis reads in `JwtStrategy.validate()` had no error handling at all — an unexpected Redis
failure there would propagate uncaught and surface as an undocumented `500` via `AllExceptionsFilter`,
rather than a deliberate, policy-driven response. This meant the actual behavior during a Redis outage
depended on which call happened to fail first, with no single documented answer to "what happens when
Redis is down."

## Decision

Two policies, chosen per call site based on whether an authoritative non-Redis fallback exists:

- **Fail closed (no fallback available)** — the check denies the request rather than letting an
  uncaught exception surface as an unrelated `500`:
  - `RateLimitGuard` (`rate-limit.guard.ts:70-82`, pre-existing): catches the error, logs it, returns
    `false` (denies the request).
  - `JwtStrategy`'s blacklist check (`jwt.strategy.ts:37-50`): catches the error, logs it, throws
    `UnauthorizedException` — same outcome as an actual blacklisted token, but attributable in logs.
  - `ModerationService.isMuted()` (`moderation.service.ts:94-105`): catches the error, logs it, returns
    `true` (treated as muted) — `ModerationGuard` already turns a `true` result into a `ForbiddenException`
    with no guard-side changes needed.

- **Degrade to the existing DB fallback (cache-only reads with a DB source of truth)** —
  `JwtStrategy`'s `user_cache` read and write (`jwt.strategy.ts:61-71, 90-102`): a Redis error on the
  read is treated identically to a cache miss (`cached` stays `null`), falling through to the DB lookup
  that already exists in the same method for that case; a Redis error on the write-back is logged and
  swallowed, since the caller already has the DB-resolved user and a failed cache write must not fail
  the request.

**Alternatives considered and rejected:**

- **Fail open everywhere on Redis error**: rejected — would bypass rate limiting and the mute/ban gate
  at exactly the moment (a Redis outage) when abuse or a banned user retrying is hardest to distinguish
  from legitimate traffic recovering; this is the opposite of what a security-relevant check should do
  under uncertainty.
- **Fail closed everywhere, including `user_cache`**: rejected specifically for `user_cache` — since a
  DB fallback already exists in the same method, failing the whole auth request on a cache-only read is
  strictly worse than the "treat as a miss" degrade, which achieves the same safety with no user-facing
  cost.

## Consequences

- Any new Redis call added to a security-relevant guard or strategy must be wrapped in a try/catch and
  assigned one of the two policies above based on whether an authoritative fallback exists — never leave
  a security-relevant Redis read unguarded and let an unexpected error fall through to a generic `500`.
- A cache-only read that already has a DB (or other authoritative) fallback path in the same method
  must reuse the "treat error as a miss" pattern, not introduce a new failure mode for what is
  functionally identical to a cache miss.
- A security check backed only by Redis with no DB equivalent (e.g. mute state, token blacklist) must
  fail closed explicitly — relying on an uncaught exception to accidentally produce a deny is not
  equivalent to a documented fail-closed policy, since the exact HTTP status and log signature differ
  and are not attributable to "Redis is down" without reading a stack trace.
