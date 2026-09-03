// 목적: "이 유저가 지금 실질적으로 밴 상태인가"를 판단하는 단일 진실 공급원(predicate).
// 사용처: ModerationService.isBanned(가드 경로)와 auth/jwt.strategy.ts(인증 단계 밴 게이트) 양쪽에서 호출.
// 근거: 가드와 인증 전략에 중복되면 보안 불변식이 조용히 어긋날 수 있음 — 한 곳에 유지.

import { UserEntity } from 'src/user/entities/user.entity';
import { ModerationStatus } from './enums/moderation-status.enum';

export function isEffectivelyBanned(
  user: Pick<UserEntity, 'status' | 'bannedUntil'>,
): boolean {
  if (user.status !== ModerationStatus.banned) return false;
  if (!user.bannedUntil) return true; // 영구
  return new Date(user.bannedUntil) > new Date(); // 기간 밴이 아직 유효
}
