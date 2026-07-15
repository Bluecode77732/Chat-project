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

## Consequences

- Never suggest adding REST controllers where GraphQL infrastructure already exists, or mixing
  Socket.IO and GraphQL Subscription for the same event — that would recreate the dual-path complexity
  this migration was done to eliminate.
- Any new automated/system message source must publish through the existing `PubSubService.publish()`
  channel, not introduce a second delivery mechanism.
- Any use case that requires guaranteed (not at-most-once) delivery needs a persistent queue (e.g.
  BullMQ) layered on top — Redis Pub/Sub alone is not sufficient for that requirement, and this is an
  accepted limitation for live chat, not an oversight.
