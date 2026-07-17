# 0017: forwardRef를 통한 AuthModule ↔ UserModule ↔ ChatModule 순환 의존성

## 상태

Accepted

## 배경

서로 독립적인 단방향 의존성 3개가 우연히 하나의 닫힌 원으로 이어져 있습니다.

- **`AuthModule → UserModule`**: `AuthModule`이 제공하는 `JwtStrategy`가 `user_cache` 미스 시
  `userService.findOne(payload.sub)`를 호출합니다(`jwt.strategy.ts:17,59`). `AuthService` 자신은
  `UserService`에 의존하지 않고, 직접 주입받은 리포지토리로 `UserEntity`를 읽습니다.
- **`UserModule → ChatModule`**: `UserService`가 `forceLogout`(`user.service.ts:43,320`)과 `remove`의
  캐스케이드 정리 경로(`user.service.ts:416`)에서 `chatService.disconnectSocket()`을 호출합니다.
- **`ChatModule → AuthModule`**: `ChatGateway.handleConnection()`이 WebSocket 핸드셰이크를 인증하기
  위해 `authService.parseBearerToken()`을 호출합니다 — 이 경로는 표준 HTTP Guard 파이프라인을 타지
  않습니다(`chat.gateway.ts:10,47,90`).

각 엣지는 단방향입니다 — 이 세 모듈 중 어느 쌍도 서로를 되받아 import하지 않습니다 — 그래서
`ModerationModule`이 `ChatModule`을 직접 import하는 대신 콜백 주입을 써서 일부러 피했던 상호/양방향
결합([ADR 0006](0006-moderation-one-directional-dependency.ko.md) 참고)과는 다릅니다. 이건 서로 다른
3개 도메인에 걸친 방향성 있는 체인(`Auth → User → Chat → Auth`)이며, 각 엣지는 다음 모듈에 의존할
독립적이고 정당한 이유를 갖고 있습니다. 한 엣지에 `forwardRef`가 없으면 NestJS는 부팅 시점에 모듈
그래프를 풀어낼 수 없습니다: `AuthModule`을 만들려면 `UserModule`이 필요하고, `UserModule`을 만들려면
`ChatModule`이 필요하고, `ChatModule`을 만들려면 다시 `AuthModule`이 필요해서, 어느 것도 먼저 완전히
정의되지 못합니다.

## 결정

`AuthModule`은 `forwardRef(() => UserModule)`(`auth.module.ts`)를 통해 `UserModule`을 import합니다 —
바로 이런 상황을 위해 NestJS가 공식 지원하는 메커니즘입니다. `forwardRef`는 순환을 없애거나 어느
모듈이 어느 모듈에 의존하는지를 바꾸지 않습니다. 모든 모듈이 등록된 뒤로 그 엣지 하나의 해석 시점을
지연시켜서, 부팅 실패를 (지연 배선이긴 하지만) 성공적인 부팅으로 바꿀 뿐입니다. `forwardRef` 적용
여부와 무관하게 순환의 모양은 동일하며, 오직 `Auth → User` 엣지를 해석하는 시점만 달라집니다.

순환을 완전히 없애는 것은 가능하지만, 세 엣지의 비용이 똑같지는 않습니다.

- `Auth → User`가 가장 싸게 없앨 수 있습니다: `JwtStrategy`가 `UserService` 대신 `AuthService`가
  이미 하고 있는 것처럼 직접 주입받은 리포지토리로 `UserEntity`를 읽으면 됩니다 — 새 패턴이 필요
  없습니다.
- `Chat → Auth`는 적당히 쌉니다: `parseBearerToken`을 `AuthService`에 두지 않고, 두 모듈이 공유하는
  의존성 없는 유틸로 분리할 수 있습니다.
- `User → Chat`가 가장 비쌉니다: `ModerationModule`의 콜백 주입 패턴이 작동하는 이유는
  `ChatResolver`가 메시지 처리 시점에 `ModerationService`를 호출하면서 같은 호출 안에서 콜백을
  넘겨줄 수 있기 때문입니다. `forceLogout`/`remove`는 `UserController`(평범한 REST 관리자 액션)에서
  호출되며, 콜백을 실어 나를 만한 호출 시점 컨텍스트가 없습니다 — 이 엣지를 없애려면 이 코드베이스에
  아직 없는 이벤트 이미터 패턴을 새로 도입해야 하며, 이는 국소적 리팩터링이 아니라 아키텍처 변경입니다.

심각도가 낮고(런타임 버그도, 보안 문제도, 데이터 정합성 문제도 아닌 부팅 순서 메커니즘 — Never Do
Group 1~3 어디에도 해당하지 않음) 가장 비싼 엣지를 완전히 없애는 비용을 고려해, 리팩터링은 진행하지
않았고 이 순환은 현재 상태 그대로 받아들여집니다.

## 결과

- `AuthModule`에서 `forwardRef(() => UserModule)`를 세 엣지 중 최소 하나를 함께 없애지 않은 채
  단독으로 삭제하는 것은 절대 제안하지 않습니다 — 그러면 `forwardRef`가 애초에 막고 있는 바로 그
  부팅 실패가 재발합니다.
- 이 순환을 완전히 분리해달라는 향후 요청은 하나의 리팩터링이 아니라, 비용이 서로 다른 세 개의
  별도 변경으로 범위를 나눠야 합니다(위 결정 참고) — 특히 `User → Chat` 엣지는 새로운 아키텍처
  패턴(이벤트 이미터) 도입이 필요해, Scope Discipline상 우발적 수정이 아니라 명시적 승인이
  필요합니다.
- 이건 새로운 순환 의존성을 위한 템플릿이 아닙니다: 이 사례가 받아들여지는 이유는 세 엣지 모두
  진짜 서로 다른 도메인(인증, 계정 관리, 실시간 연결)에 걸쳐 독립적으로 단방향이기 때문입니다.
  두 모듈이 **같은** 기능 도메인을 두고 상호/양방향으로 결합될 새 의존성이 생긴다면, 여전히
  `forwardRef`가 아니라 `ModerationModule`의 콜백 주입 패턴(ADR 0006)을 기본으로 삼아야 합니다.
