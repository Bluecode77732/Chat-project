# 0023: Re-check the ban per delivered message on `receiveMessage` subscriptions

## Status

Accepted

## Context

`ChatResolver.receiveMessage` (`chat.resolver.ts:313-333`) checks authentication and room membership
once, when the subscription starts. A ban was enforced at `jwt.strategy` (HTTP/GraphQL), at
`handleConnection` (socket) and at token refresh, none of which touch a `graphql-ws` subscription
that is already open. A user banned after subscribing therefore kept receiving new messages
(confirmed in a local run on 2026-10-26).

Closing the subscription from the ban path is harder than it looks: the subscription lives in the
`graphql-ws` connection, which is not tracked per user anywhere, and with more than one backend
instance the connection may be held by another process.

## Decision

`receiveMessage` returns the pub/sub iterator wrapped by `ChatResolver.endWhenBanned()`
(`chat.resolver.ts:335-372`). Each time the source iterator yields a message, the wrapper calls
`ModerationService.isUserBanned(userId)`. If the user is banned, it closes the source iterator
(`return()`) and ends the subscription without delivering that message.

- `return()` and `throw()` are forwarded straight to the source iterator instead of being implemented
  as an `async function*`: a generator queues `return()` behind a pending `next()`, so a subscriber
  that is waiting for its next message could not be released when the client disconnects.
- `isUserBanned` and the other ban gates (`jwt.strategy`, token refresh) share `isEffectivelyBanned()`
  (`moderation.util.ts`), so a subscription uses the same ban rule (`status` and `bannedUntil`) as
  every other path. `handleConnection` calls `isUserBanned` directly.

**Alternatives considered and rejected:**

- **Close the `graphql-ws` connection from the ban path**: rejected — connections are not indexed by
  user, so it needs a new registry, and that registry has to work across instances. The per-message
  check needs neither.
- **Re-check on a timer**: rejected — it adds a second moving part and still leaves a window in which a
  banned user receives messages.
- **Cache the ban state in Redis for the check**: not done — a stale cache entry would keep a banned
  user's subscription alive until it expires, and a cache needs its own invalidation on ban and unban.

## Consequences

- A banned subscriber's subscription ends when the next message would be delivered to them, not at the
  moment of the ban, and that message is not delivered. A banned user in a quiet room keeps an idle
  subscription open until a message arrives or the client disconnects.
- Every delivered message costs one `userRepository.findOne` (select of `status` and `bannedUntil`) per
  subscriber. The cost grows with subscribers times messages and was not measured. Add a bounded cache
  only together with explicit invalidation on ban and unban.
- A forced logout (`UserService.forceLogout`) is not covered: it disconnects the socket but leaves an
  open subscription, and it does not revoke an already-issued access token (listed in ROADMAP).
- Any new long-lived subscription that delivers room content must apply the same per-delivery check
  rather than rely on the check made at subscribe time.
