# 0015: Audit trail for every privileged/enforcement action

## Status

Accepted

## Context

Privileged actions (role changes, forced logout, user deletion) and automated moderation enforcement
(mute, ban, unban) change another user's access or standing in the system. Application logs
(`winston`, rotated, unstructured) are not a reliable or queryable record of who did what to whom —
they're for debugging, not accountability.

## Decision

`AuditLogService.log(actorId, targetId, action, detail?)` records every one of these actions as a
separate, queryable entity, independent of the application log stream:

- `UserService`: `'ROLE_CHANGE'` (`user.service.ts:293-298`), `'FORCE_LOGOUT'`
  (`user.service.ts:323`), `'USER_DELETE'` (`user.service.ts:419`) — `actorId` is the admin performing
  the action.
- `ModerationService`: `'USER_MUTED'` (`moderation.service.ts:243-248`), `'USER_BANNED'`
  (`moderation.service.ts:277-282`), `'USER_UNBAN'` (`moderation.service.ts:179`) — `actorId` is
  `getSystemUserId()`, since these are automated enforcement actions, not human admin actions; the
  audit trail attributes them to the system account rather than leaving `actorId` null or omitting the
  entry.
- `AuditLogService.countByTarget(userId, 'USER_BANNED')` (`moderation.service.ts:262-265`) is read back
  by `applyBan` to decide whether a repeat ban on the same user should escalate to permanent — the
  audit log is a write-once record consumed as read-side state, not append-only-and-ignored.
- Admin-facing audit-log CSV export is one of `admin/`'s stated features (see README's
  [Admin Panel](../README.md#admin-panel) section).

## Consequences

- Any new privileged action (role change, force logout, deletion, ban, mute, unban, or a future
  enforcement type) must call `AuditLogService.log()` — never add a privileged mutation without an
  audit entry, human-triggered or automated.
- Automated/system-triggered actions must attribute `actorId` to `getSystemUserId()`, not leave it
  null — a null actor breaks the "who did this" guarantee the audit trail exists to provide, even for
  system-initiated enforcement.
- If a new action needs to read back audit history to make a decision (as `applyBan` does for
  repeat-offender escalation), use `AuditLogService.countByTarget()`/equivalent query methods rather
  than re-deriving that state from a different source — the audit log is the source of truth for
  action history.
