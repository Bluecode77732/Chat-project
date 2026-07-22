# 0001: JWT 액세스/리프레시 토큰 분리

## 상태

Accepted

## 배경

이 앱의 인증은 REST 엔드포인트, GraphQL(쿼리·뮤테이션·구독), Socket.IO 연결까지 세 영역을 모두
감당해야 합니다. 그러면서도 매 요청마다 세션 스토어를 조회하는 구조는 피해야 하므로, 무상태
(stateless) 인증이 필요합니다.

## 결정

- `accessToken`: 수명 15분. 프론트엔드에서는 메모리(Zustand 스토어)에만 보관하며, `localStorage`나
  쿠키에는 절대 저장하지 않습니다.
- `refreshToken`: 수명 7일. 로그인 시 백엔드가 httpOnly 쿠키(`secure: true`, `sameSite: 'none'`)로
  설정합니다.
- 가드는 상속이 아니라 조합으로 연결합니다. REST는 `JwtAuthGuard` → `RbacGuard` → 핸들러 순서이고,
  GraphQL에는 이에 대응하는 `GraphQLAuthGuard` → `GraphQLRBACGuard`가 있습니다(`chat.resolver.ts`).
- WebSocket 인증은 `handleConnection`에서 `client.handshake.headers.authorization`(Socket.IO
  핸드셰이크 헤더의 Bearer 토큰)을 검증합니다. WS 전용 인증 메커니즘을 따로 두지 않습니다.
- 로그아웃(`POST /auth/signOut`) 시 백엔드가 서버 측에서 `res.clearCookie('refreshToken')`을
  호출하고, 프론트엔드는 Zustand 스토어를 비운 뒤 리다이렉트합니다.
- 조용한 토큰 갱신은 전부 `refreshAccessTokenSafely()`
  (`frontend/src/auth/session-guard.ts`) 한 함수를 거칩니다. 동시에 여러 곳에서 갱신을 요청해도
  진행 중인 요청 하나를 공유하므로, 두 번째 호출자가 리다이렉트 도중 충돌하는 계정을 잘못
  채택하는 레이스 컨디션이 생기지 않습니다.
- 탭 사이의 신원 충돌은 별도로 방어합니다. `sessionStorage['chat:sessionUserId']`에 이 탭이
  마지막으로 인증한 계정을 기록해 두는데, `refreshToken` 쿠키는 탭끼리 공유되므로 갱신 결과가
  다른 계정으로 나온다면 다른 탭에서 다른 계정으로 로그인했다는 뜻입니다. 이때는 새 신원을
  조용히 이어받는 대신 해당 탭을 로그아웃시킵니다.
- 고려했다가 배제한 대안:
  - **세션 기반 인증**(서버 측 세션 스토어 + 세션 ID 쿠키): REST, GraphQL, Socket.IO 세 영역
    전부에서 매 요청마다 스토어 조회가 강제됩니다. 이 설계가 애초에 피하려던 것이 바로 그
    요청별 조회이므로 배제했습니다.
  - **리프레시 없는 단일 장기 토큰**: 만료를 길게 잡으면 토큰이 탈취됐을 때 수명 내내 유효해서
    블랙리스트 말고는 무효화할 방법이 없고, 짧게 잡으면 조용한 갱신이 없는 한 사용자가 수시로
    재로그인해야 합니다. 어느 쪽이든 나쁜 선택지입니다. 액세스/리프레시를 분리하면 액세스
    토큰을 짧게 유지하면서도 이 UX 비용이 사라집니다.
  - **`accessToken`을 `localStorage`에 저장**: XSS에 노출되므로 배제했습니다. 이 프로젝트가
    개발 중 실제로 발견해 고친 XSS/localStorage 토큰 저장 취약점(README의
    [프로젝트 동기](../README.ko.md#프로젝트-동기) 참고)이 이 규칙의 배경입니다 — 가상의
    우려가 아니라 실제 사례입니다.
  - **`refreshToken`을 응답 바디로 반환**: `localStorage`와 같은 이유로 배제했습니다. JS가
    읽을 수 있는 저장소는 XSS 페이로드도 똑같이 읽을 수 있습니다.

## 결과

- REST 전용 인증, 세션 기반 인증, `accessToken`의 `localStorage` 저장은 절대 제안하지 않습니다.
  이 분리 설계가 애초에 막아둔 XSS/CSRF 트레이드오프를 다시 여는 일이기 때문입니다.
- 최신 `accessToken`이 필요한 코드를 새로 추가할 때는 `/auth/token/refreshaccess`를 직접
  호출하지 말고 반드시 `refreshAccessTokenSafely()`를 거쳐야 합니다. 직접 호출하면 공유
  리프레시의 레이스 방어가 우회됩니다.
- 새로운 역할 기반 가드는 반드시 `JwtAuthGuard`/`GraphQLAuthGuard`와 조합해서 만들어야 하며,
  부모 가드의 전제 조건을 강화하는 서브클래스로 만들면 안 됩니다. 이 프로젝트가 이미 한 번
  걷어낸 LSP 위반 사례가 있습니다 — `chat.resolver.ts`에서 `@RBAC(UserRole.admin)` + 조합
  가드로 대체되기 전의 `GraphQLAdminGuard extends GraphQLAuthGuard`가 그것입니다.
