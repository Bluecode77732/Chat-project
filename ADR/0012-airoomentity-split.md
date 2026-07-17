# 0012: `AiRoomEntity` split out of `RoomEntity`

## Status

Accepted

## Context

A room's active AI personality was originally a nullable `aiPersonality` column directly on
`RoomEntity` — every room carried an AI-specific field regardless of whether it was an AI-companion
room or a plain human-to-human room.

## Decision

Migration `ExtractAiPersonalityToAiRoomEntity` (`1749639600000`) moved the personality field into a
separate `AiRoomEntity`, related back to `RoomEntity` via a `OneToOne` relation with
`onDelete: 'CASCADE'`.

- **Why:** separation of concerns between AI-specific room state and general room state, and cleaner
  ongoing management of that data as the AI feature grew (per the developer).

## Consequences

- `RoomEntity` stays free of AI-specific columns that don't apply to every room — any future
  AI-room-only field (e.g. a per-room conversation-history cap override) belongs on `AiRoomEntity`,
  not back on `RoomEntity`.
- The `OneToOne` relation's `onDelete: 'CASCADE'` means deleting a `RoomEntity` also deletes its
  `AiRoomEntity` row automatically — any new query that reads AI-room config must handle the case
  where no `AiRoomEntity` exists (a non-AI room), not assume the relation is always populated.
- Never suggest re-merging AI-specific fields back onto `RoomEntity` "to simplify the join" — that
  reopens the every-room-carries-unused-AI-columns problem this split was made to fix.
