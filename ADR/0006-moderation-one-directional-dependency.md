# 0006: ModerationModule's one-directional dependency

## Status

Accepted

## Context

`ChatModule` already depends on `ModerationModule` — `sendMessage` uses `ModerationGuard` to gate
muted/banned users (see [0004](0004-graphql-socketio-api-layer-split.md)), and `ChatResolver` calls
`ModerationService.evaluateMessage()` after each message commits. If `ModerationModule` also imported
`ChatModule` (e.g. to publish a warning/mute/ban notice back into the room, or to disconnect a socket
on enforcement), that would create a NestJS module cycle.

## Decision

`ModerationModule` never imports `ChatModule`. `ModerationService` receives the chat-side effects it
needs (`publishFn`, `disconnectFn`) as callbacks injected by `ChatResolver` at call time, not as
injected chat services — the identical pattern `AiService.handleReply()` already uses for the same
reason. Documented at `backend/src/moderation/moderation.module.ts:1-4`; the actual callback shape is
`ModerationCallbacks` in `moderation.service.ts:39-43`.

- Alternatives considered and rejected:
  - **`ModerationModule` imports `ChatModule` directly**: this is the alternative the Context section
    above already argues against — it would create the exact module cycle (`Chat → Moderation → Chat`)
    this ADR exists to avoid, for no benefit over the callback pattern already proven by `AiService`.
  - **An event emitter** (e.g. NestJS's `EventEmitter2`) instead of directly-injected callbacks:
    `ModerationService` would emit a domain event (`moderation.mute`, `moderation.ban`) and `ChatModule`
    would listen, avoiding a direct import in either direction. Rejected for now — it would introduce a
    new architectural pattern not used anywhere else in this codebase, for a problem the
    callback-injection pattern (already proven twice, here and in `AiService`) already solves at lower
    cost.

## Consequences

- Never suggest importing `ChatModule` into `ModerationModule` "for convenience" — it reintroduces the
  cycle this pattern exists to avoid.
- Any future module that needs to act on a chat room from outside `ChatModule` (a new automated
  moderation-like feature, for instance) should default to this same callback-injection pattern rather
  than a new cross-module import, unless there's a concrete reason the pattern doesn't fit.
- The tradeoff: `ModerationService`'s public methods that need chat effects (e.g.
  `evaluateMessage`) must accept a `ModerationCallbacks`-shaped parameter, which is one extra
  parameter callers must thread through — deliberately accepted in exchange for not depending on
  `ChatModule` at the DI level.
