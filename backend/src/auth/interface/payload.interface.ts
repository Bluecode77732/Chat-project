import { UserRole } from '../role/role';

export interface Payload {
  sub: number;

  type: 'refresh' | 'access';

  role: UserRole;

  // 발급된 refresh token의 고유 id — 이 토큰을 대체하는 더 최신 로그인을 감지하는 데 사용.
  // refresh token에만 존재.
  jti?: string;

  // iat/exp는 JWT 라이브러리가 추가 — 이 payload에는 포함되지 않음.
}
