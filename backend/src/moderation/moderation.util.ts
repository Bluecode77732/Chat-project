// Purpose: single source of truth for the "is this user effectively banned right now" predicate.
// Usage: ModerationService.isBanned (guard path) and auth/jwt.strategy.ts (auth-level ban gate) both call it.
// Rationale: a security invariant duplicated across the guard and the auth strategy could silently diverge — keep it in one place.

import { UserEntity } from 'src/user/entities/user.entity';
import { ModerationStatus } from './enums/moderation-status.enum';

export function isEffectivelyBanned(
  user: Pick<UserEntity, 'status' | 'bannedUntil'>,
): boolean {
  if (user.status !== ModerationStatus.banned) return false;
  if (!user.bannedUntil) return true; // permanent
  return new Date(user.bannedUntil) > new Date(); // timed ban still active
}
