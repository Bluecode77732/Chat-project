// 목적: moderation 임계치/지속시간, 시스템 계정 이메일, 사용자 노출 안내 문구, Redis 키
// 빌더를 한곳에 모은 기본값 모음.
// 사용처: moderation.service.ts와 moderation.guard.ts에서 import.
// 근거: 튜닝 값을 한곳에 모아두고 MODERATION_* env var가 없을 때 fallback을 제공.

// moderation 시스템 메시지를 작성하는 예약 계정(로그인 안 함) — ai.service의 AI_USER_EMAIL과 대응.
export const SYSTEM_USER_EMAIL = 'system@chat.internal';

// 대응하는 MODERATION_* env var가 없을 때만 쓰이는 fallback 값; 실제 소스는 ConfigService.
export const MODERATION_DEFAULTS = {
  strikeWindowSec: 86400, // strike가 유효한 rolling window (24h)
  warnThreshold: 3,
  muteThreshold: 5,
  muteDurationSec: 600, // 10분
  banThreshold: 7,
  banDurationSec: 604800, // 7일 시한부 ban
  dupWindowSec: 60,
  dupThreshold: 3,
} as const;

// velocity-strike marker window: RateLimitGuard의 15초 윈도우와 맞춰서 burst가 한 번만 카운트되게 함.
export const VELOCITY_MARK_TTL_SEC = 15;

// 위반이 발생한 room에 게시되는 사용자 노출용 시스템 안내 문구.
export const MODERATION_NOTICE = {
  warn: '반복적인 메시지가 감지되었습니다. 계속되면 일시적으로 전송이 제한될 수 있어요.',
  mute: '일시적으로 메시지 전송이 제한되었습니다. 잠시 후 다시 시도해주세요.',
  banTimed: '반복 위반으로 계정 이용이 일시 정지되었습니다.',
  banPermanent: '반복 위반으로 계정 이용이 영구 정지되었습니다.',
} as const;

// Redis 키 — {service}:{entity}:{id} 컨벤션, 모든 키는 쓰기 시점에 TTL을 가짐.
export const moderationKeys = {
  strike: (userId: number): string => `moderation:strike:${userId}`,
  dup: (userId: number, hash: string): string =>
    `moderation:dup:${userId}:${hash}`,
  mute: (userId: number): string => `moderation:mute:${userId}`,
  velMark: (userId: number): string => `moderation:velmark:${userId}`,
} as const;
