# 0006: ModerationModule의 단방향 의존성

## 상태

Accepted

## 배경

`ChatModule`은 이미 `ModerationModule`에 의존합니다 — `sendMessage`는 `ModerationGuard`로
음소거/차단된 사용자를 걸러내고([0004](0004-graphql-socketio-api-layer-split.ko.md) 참고),
`ChatResolver`는 각 메시지가 커밋된 뒤 `ModerationService.evaluateMessage()`를 호출합니다. 만약
`ModerationModule`도 `ChatModule`을 임포트한다면(예: 경고/음소거/차단 알림을 룸에 다시 발행하거나,
제재 시 소켓 연결을 끊기 위해) NestJS 모듈 사이클이 생겨버립니다.

## 결정

`ModerationModule`은 절대 `ChatModule`을 임포트하지 않습니다. `ModerationService`는 필요한 채팅
쪽 효과(`publishFn`, `disconnectFn`)를 주입된 채팅 서비스가 아니라, 호출 시점에 `ChatResolver`가
넘겨주는 콜백으로 받습니다 — `AiService.handleReply()`가 동일한 이유로 이미 사용하고 있는 패턴과
똑같습니다. `backend/src/moderation/moderation.module.ts:1-4`에 문서화되어 있고, 실제 콜백
형태는 `moderation.service.ts:39-43`의 `ModerationCallbacks`입니다.

## 결과

- "편의를 위해" `ModerationModule`에 `ChatModule`을 임포트하는 것은 절대 제안하지 않습니다 — 이
  패턴이 애초에 피하려던 사이클을 다시 만들어버립니다.
- `ChatModule` 밖에서 채팅 룸에 작용해야 하는 향후 모듈(예: 새로운 자동 모더레이션 유사 기능)은
  구체적으로 이 패턴이 맞지 않는 이유가 없는 한, 새로운 모듈 간 임포트 대신 이 콜백 주입 패턴을
  기본으로 삼아야 합니다.
- 트레이드오프: 채팅 쪽 효과가 필요한 `ModerationService`의 공개 메서드(예: `evaluateMessage`)는
  `ModerationCallbacks` 형태의 파라미터를 반드시 받아야 하며, 이는 호출자가 하나 더 꿰어야 하는
  파라미터입니다 — DI 레벨에서 `ChatModule`에 의존하지 않는 대가로 의도적으로 받아들인
  트레이드오프입니다.
