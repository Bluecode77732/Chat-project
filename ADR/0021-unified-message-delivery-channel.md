# 0021: Single delivery channel/shape for human, AI, and moderation system messages

## Status

Accepted

## Context

`sendMessage` publishes a human-sent message to `receiveMessage :${roomId}` (`chat.resolver.ts:206-208`).
Two automated sources also need to deliver messages into the same rooms: AI-companion replies
(`AiService.handleReply()`) and moderation system notices (warn/mute/ban text, via
`ModerationService.sendSystemMessage()`). Without a shared rule, each new automated source could
plausibly invent its own delivery path (a second GraphQL field, a direct Socket.IO emit, a different
pub/sub channel), forcing the frontend to branch on sender type to render each one.

## Decision

Every message source — human, AI, moderation — publishes through the identical
`pubSub.publish(`receiveMessage :${roomId}`, { receiveMessage: msg })` call and `ChatEntity`-shaped
payload:

- Human: `chat.resolver.ts:206-208`, inline in the `sendMessage` resolver.
- AI: `chat.resolver.ts:285-289`, via a `publishFn` callback `ChatResolver` hands to
  `AiService.handleReply()` post-commit ([ADR 0007](0007-ai-reply-distributed-lock.md) covers the
  per-room lock around this call; this ADR covers only the delivery shape).
- Moderation: `chat.resolver.ts:240-243`, via an identical `publishFn` callback handed to
  `ModerationService.evaluateMessage()`, which `ModerationService.sendSystemMessage()`
  (`moderation.service.ts:320-339`) calls after first persisting the notice as a real `ChatEntity` row
  (attributed to the system user, same as AI's messages) — not a transient, unpersisted broadcast.

No second delivery mechanism exists anywhere in the codebase for any of these three sources — one
channel, one shape, one frontend render path with no sender-type branching.

## Consequences

- Any new automated/system message source (a future moderation action type, a bot, a scheduled
  announcement) must publish through this exact same `publishFn`-callback-into-`ChatResolver` shape —
  never introduce a second GraphQL field, REST endpoint, or direct Socket.IO emit for message delivery.
  See [ADR 0006](0006-moderation-one-directional-dependency.md) for why the callback (not a direct
  service import) is also how the *module-dependency* side of this is kept one-directional.
- Redis Pub/Sub delivers at-most-once ([ADR 0004](0004-graphql-socketio-api-layer-split.md)) — this
  applies identically to AI and moderation messages, not just human ones. A subscriber disconnected at
  publish time misses a moderation warning exactly as it would miss a human message, with no replay.
- A moderation system message is persisted to `ChatEntity` *before* it is published (unlike a pure
  notification), so it survives page reloads / cursor-paginated history the same way a human message
  does — never suggest a moderation notice that publishes without a matching `chatRepository.save()`,
  or it silently disappears on the next history fetch.
