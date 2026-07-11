// Purpose: shared user moderation-state type consumed by UserEntity and ModerationService.
// Usage: imported by user.entity.ts (column type) and moderation.service.ts / moderation.guard.ts.
// Rationale: an entity<->service cross-file contract, so it lives in its own file — mirrors auth/role/role.ts.

export enum ModerationStatus {
  active = 'active',
  banned = 'banned',
}
