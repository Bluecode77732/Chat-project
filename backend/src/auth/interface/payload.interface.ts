import { UserRole } from '../role/role';

// 최소한의 JWT payload 인터페이스.
export interface Payload {
  // 조회용 사용자 ID.
  sub: number;

  // access/refresh 토큰 구분
  type: 'refresh' | 'access';

  // 인가 레벨 구분
  role: UserRole;

  // 발급된 refresh token의 고유 id — 이 토큰을 대체하는 더 최신 로그인을 감지하는 데 사용.
  // refresh token에만 존재.
  jti?: string;

  // iat/exp는 JWT 라이브러리가 추가 — 이 payload에는 포함되지 않음.
}
