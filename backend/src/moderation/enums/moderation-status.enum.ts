// 목적: UserEntity와 ModerationService가 공유하는 유저 모더레이션 상태 타입.
// 사용처: user.entity.ts(컬럼 타입), moderation.service.ts / moderation.guard.ts에서 임포트.
// 근거: entity<->service 간 크로스파일 계약이므로 별도 파일로 분리 — auth/role/role.ts와 동일한 패턴.

export enum ModerationStatus {
  active = 'active',
  banned = 'banned',
}
