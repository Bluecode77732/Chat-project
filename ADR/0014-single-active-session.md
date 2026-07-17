# 0014: Single active session per user (auto-evict prior socket)

## Status

Accepted

## Context

`SessionCacheService` tracks one `userId → {socketId, status}` mapping per user in Redis. Without an
eviction rule, a user opening a second tab or a second device would register a second concurrent
socket for the same `userId`, and both sockets would independently be treated as "the" connection for
that user — e.g. both could receive `forceLogout`/room-conflict events intended for only one session,
or a room broadcast could reach a stale socket the user no longer considers active.

## Decision

`ChatGateway.handleConnection()` records the new socket as the current session first, then — if a
different socket was previously registered for the same user — calls `kickPreviousSession()`
(`chat.gateway.ts:57-62`), which emits a `forceLogout` event to the superseded socket and disconnects
it. The write-then-kick order is deliberate: recording the new session before kicking the old one
avoids a race where the old socket's own disconnect handler (`removeClient`,
`chat.gateway.ts:65-69`) could otherwise clobber the new session's online status back to offline
(`chat.gateway.ts:41-46`, inline comment).

## Consequences

- At most one live socket per user at any time — any new per-user real-time registration (not just
  this existing Socket.IO path) must check for and evict a prior registration the same way, rather than
  assuming one connection per user is guaranteed elsewhere.
- The superseded session's frontend receives an explicit `forceLogout` event rather than silently
  dropping — never suggest disconnecting the previous socket without emitting this event first, since
  the frontend depends on it to show a "logged in elsewhere" state instead of an unexplained drop.
- Never suggest reordering `handleConnection` to kick the previous session before recording the new
  one — that reopens the specific race the current order was written to avoid (see the inline comment
  at `chat.gateway.ts:41-46`).
