# 0004: GraphQL for data, Socket.IO for connection lifecycle only

## Status

Accepted

## Context

Real-time chat needs both a transactionally-safe write path for messages and low-latency connection
management (auth-on-connect, room join/leave, forced logout on session conflict). Per README's
[Stacks](../README.md#stacks) section, messages were originally sent directly over raw Socket.IO and
migrated to GraphQL mid-project specifically to get the transactional guarantees a bare socket handler
can't provide (see [0003](0003-database-transaction-strategy.md)).

## Decision

- All chat messages flow through the `sendMessage` GraphQL mutation and `receiveMessage` GraphQL
  subscription (by `roomId`) — this is the only message-delivery path.
- `ChatGateway` (Socket.IO) handles exactly three things: connection auth (`handleConnection` /
  `handleDisconnect`), pushing a `CreateRoom` event when a new room is created, and `forceLogout` on
  session conflict. It has no `@SubscribeMessage` handler for chat messages and emits none.
- AI-generated replies and any future automated/system message source publish through the identical
  `receiveMessage :${roomId}` channel and shape as human messages
  (`chat.resolver.ts:284-289` vs `:206`) — one delivery path, no sender-type branching in clients.
- Redis Pub/Sub (`graphql-redis-subscriptions`) provides at-most-once delivery for `receiveMessage` — a
  subscriber not connected at publish time misses the message permanently, with no replay.
- Alternatives considered and rejected:
  - **Staying on raw Socket.IO for messages** (the pre-migration state): rejected — a bare socket handler
    has no way to get the ACID guarantees `GqlTransactionInterceptor` provides around the
    room-create-plus-message-save write (see [0003](0003-database-transaction-strategy.md)); this was the
    actual, lived reason for the migration, not a hypothetical comparison.
  - **Running both paths at once** (Socket.IO message events alongside the GraphQL mutation): rejected —
    forces the frontend to reconcile two sources of the same event and risks duplicate or
    out-of-order delivery; this is also explicitly a Never Do in CLAUDE.md.
  - **A persistent queue (e.g. BullMQ) instead of Redis Pub/Sub**: rejected for the general case — adds
    operational complexity (a worker process, job retention policy) that live chat doesn't need, since a
    missed at-most-once delivery here just means "didn't see a message while disconnected," not a lost
    business event. Left as the documented answer for any *future* use case that does need guaranteed
    delivery, not adopted now.

## Consequences

- Never suggest adding REST controllers where GraphQL infrastructure already exists, or mixing
  Socket.IO and GraphQL Subscription for the same event — that would recreate the dual-path complexity
  this migration was done to eliminate.
- Any new automated/system message source must publish through the existing `PubSubService.publish()`
  channel, not introduce a second delivery mechanism.
- Any use case that requires guaranteed (not at-most-once) delivery needs a persistent queue (e.g.
  BullMQ) layered on top — Redis Pub/Sub alone is not sufficient for that requirement, and this is an
  accepted limitation for live chat, not an oversight.
