// Purpose: central defaults for moderation thresholds/durations, the system-account email, user-facing notice texts, and Redis key builders.
// Usage: imported by moderation.service.ts and moderation.guard.ts.
// Rationale: keeps tuning knobs in one place and supplies fallbacks when the MODERATION_* env vars are unset.

// Reserved account that authors moderation system messages (never logs in) — mirrors ai.service AI_USER_EMAIL.
export const SYSTEM_USER_EMAIL = 'system@chat.internal';

// Fallback values used only when the matching MODERATION_* env var is absent; ConfigService is the source of truth.
export const MODERATION_DEFAULTS = {
  strikeWindowSec: 86400, // rolling window a strike lives in (24h)
  warnThreshold: 3,
  muteThreshold: 5,
  muteDurationSec: 600, // 10m
  banThreshold: 7,
  banDurationSec: 604800, // 7d timed ban
  dupWindowSec: 60,
  dupThreshold: 3,
} as const;

// velocity-strike marker window: matches RateLimitGuard's 15s window so a burst counts once.
export const VELOCITY_MARK_TTL_SEC = 15;

// User-facing system notices posted into the room where the violation happened.
export const MODERATION_NOTICE = {
  warn: '반복적인 메시지가 감지되었습니다. 계속되면 일시적으로 전송이 제한될 수 있어요.',
  mute: '일시적으로 메시지 전송이 제한되었습니다. 잠시 후 다시 시도해주세요.',
  banTimed: '반복 위반으로 계정 이용이 일시 정지되었습니다.',
  banPermanent: '반복 위반으로 계정 이용이 영구 정지되었습니다.',
} as const;

// Redis keys — {service}:{entity}:{id} convention, every key carries a TTL at write time.
export const moderationKeys = {
  strike: (userId: number): string => `moderation:strike:${userId}`,
  dup: (userId: number, hash: string): string =>
    `moderation:dup:${userId}:${hash}`,
  mute: (userId: number): string => `moderation:mute:${userId}`,
  velMark: (userId: number): string => `moderation:velmark:${userId}`,
} as const;
