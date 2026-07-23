# 0007: Per-room distributed lock for AI reply generation

## Status

Accepted

## Context

Two messages arriving in quick succession for the same AI-companion room (e.g. a client retry, or two
tabs) could each independently trigger `AiService.handleReply()`, producing two concurrent Gemini API
calls and two AI replies for what should be one turn of conversation.

## Decision

`AiService.handleReply()` acquires an atomic Redis lock before generating a reply:
`SET ai:lock:{roomId} 1 EX 30 NX` (`ai.service.ts:115-122`; TTL is the `AI_LOCK_TTL_SECONDS` constant,
`ai.service.ts:22`). If the `SET ... NX` fails to acquire (lock already held), the call logs and
returns immediately rather than queuing (`ai.service.ts:124-127`) — a skipped reply, not a queued one.
The lock is released in a `finally` block (`ai.service.ts:196`) so it's freed even if reply generation
throws.
- Alternatives considered and rejected:
  - **Non-atomic check-then-set** (`GET` to check, then `SET` if absent): rejected — the gap between the
    two commands is exactly the race two near-simultaneous triggers would hit, reopening the double-reply
    bug this lock exists to close.
  - **A database-level lock** (e.g. `SELECT ... FOR UPDATE` on the room row) instead of a Redis key:
    rejected — would hold a DB connection and transaction open for the full duration of the Gemini API
    call, which is network-bound and can take seconds; a Redis key is held by a lightweight `SET`/`DEL`
    pair instead.
  - **A global lock** (not per-room): rejected — would serialize AI replies across every unrelated room
    in the app for no reason, since the actual race only exists within a single room.

## Consequences

- Never suggest a non-atomic check-then-set (`GET` then `SET`) for this or any similar per-resource
  lock — it reopens the same race this pattern exists to close. `SET ... NX` (or equivalent atomic
  primitive) is required.
- The lock is *skip*, not *queue* — a second trigger while the lock is held gets no reply at all, not
  a delayed one. This is an accepted tradeoff for chat UX (a delayed duplicate reply arriving out of
  context is worse than a silent skip); a future feature that needs queuing semantics needs a
  different mechanism (e.g. a job queue), not a longer-held lock.
- The 30s TTL is a safety net against a crashed process leaving the lock held forever — it is not
  meant to be reached in the normal case (Gemini calls are expected to complete well under that). Any
  future increase to typical reply latency (larger models, longer prompts) should re-examine this TTL,
  not treat it as fixed.
- Per-room (not per-user, not global) is the correct lock granularity here — a global lock would
  serialize AI replies across unrelated rooms for no reason; a per-user lock doesn't prevent the
  same-room double-trigger case this exists for.
