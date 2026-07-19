# 0001: JWT 액세스/리프레시 토큰 분리

## 상태

Accepted

## 배경

이 앱은 REST 표면과 GraphQL(쿼리, 뮤테이션, 구독), 그리고 Socket.IO 연결까지 아우르는 무상태 인증이
필요합니다. 매 요청마다 세션 스토어를 조회하지 않으면서도 이를 만족해야 합니다.

## 결정

- `accessToken`: 15분 수명, 프론트엔드에서는 메모리(Zustand 스토어)에만 보관 — `localStorage`나
  쿠키에는 절대 쓰지 않습니다.
- `refreshToken`: 7일 수명, 로그인 시 백엔드가 설정하는 httpOnly 쿠키(`secure: true`,
  `sameSite: 'none'`)에 저장합니다.
- 가드 순서는 상속이 아니라 조합입니다: `JwtAuthGuard` → `RbacGuard` → 핸들러(REST), GraphQL
  쪽은 이에 대응하는 `GraphQLAuthGuard` → `GraphQLRBACGuard`(`chat.resolver.ts`).
- WebSocket 인증은 `handleConnection`에서 `client.handshake.headers.authorization`(Socket.IO
  핸드셰이크 헤더의 Bearer 토큰)으로 검증합니다 — WS 전용 별도 인증 메커니즘은 없습니다.
- 로그아웃(`POST /auth/signOut`)은 백엔드가 서버 측에서 `res.clearCookie('refreshToken')`을
  호출하고, 프론트엔드는 Zustand 스토어를 비운 뒤 리다이렉트합니다.
- 조용한 토큰 갱신은 모두 하나의 함수 `refreshAccessTokenSafely()`
  (`frontend/src/auth/session-guard.ts`)를 거칩니다 — 동시 호출자는 진행 중인 요청 하나를 공유하며,
  이는 두 번째 호출자가 리다이렉트 도중 충돌하는 계정을 잘못 채택해버리는 레이스 컨디션을 막습니다.
- 고려했다가 배제한 대안:
  - **세션 기반 인증**(서버 측 세션 스토어 + 세션 ID 쿠키): REST, GraphQL, Socket.IO 세 표면
    전부에서 매 요청마다 스토어 조회를 강제하게 되는데, 이건 이 설계가 애초에 피하려던 바로 그
    요청별 조회라서 배제.
  - **리프레시 없는 단일 장기 토큰**: 만료를 길게 잡으면 토큰이 탈취됐을 때 수명 내내 유효해서
    블랙리스트로만 무효화할 수 있고, 짧게 잡으면서 조용한 갱신이 없으면 사용자가 자주 재로그인해야
    함 — 둘 다 나쁜 선택지 사이에서 고르게 됨. 액세스/리프레시 분리가 액세스 토큰을 짧게 유지하면서도
    이 UX 비용을 없애줌.
  - **`accessToken`을 `localStorage`에 저장**: XSS 노출 때문에 배제 — 이 프로젝트가 개발 중 실제로
    자체 발견한 XSS/localStorage 토큰 저장 취약점(README의
    [프로젝트 동기](../README.ko.md#프로젝트-동기) 참고)이 이 규칙의 배경이 된 실제
    사고이지, 가상의 우려가 아닙니다.
  - **`refreshToken`을 응답 바디로 반환**: `localStorage`와 같은 이유로 배제 — JS가 읽을 수 있는
    저장소는 무엇이든 XSS 페이로드도 읽을 수 있습니다.

## 결과

- REST 전용 인증, 세션 기반 인증, `accessToken`을 `localStorage`에 저장하는 방식은 절대 제안하지
  않습니다 — 이 분리가 애초에 피하려던 XSS/CSRF 트레이드오프를 다시 열어버립니다.
- 새로 추가되는 호출부가 최신 `accessToken`이 필요하다면 `/auth/token/refreshaccess`를 직접
  호출하지 말고 반드시 `refreshAccessTokenSafely()`를 거쳐야 합니다 — 그렇지 않으면 공유 리프레시의
  레이스 보호가 우회됩니다.
- 새로운 역할 기반 가드는 반드시 `JwtAuthGuard`/`GraphQLAuthGuard`와 조합해서 만들어야 하며, 부모
  가드의 전제 조건을 강화하는 서브클래스로 만들면 안 됩니다(이 프로젝트가 이미 한 번 제거한 LSP 위반
  사례 — `chat.resolver.ts`에서 `@RBAC(UserRole.admin)` + 조합된 가드로 대체되기 전의
  `GraphQLAdminGuard extends GraphQLAuthGuard`를 참고).
