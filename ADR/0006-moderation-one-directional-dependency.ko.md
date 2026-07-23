# 0006: ModerationModule의 단방향 의존성

## 상태

Accepted

## 배경

`ChatModule`은 이미 `ModerationModule`에 의존합니다. `sendMessage`는 `ModerationGuard`로
뮤트/차단된 사용자를 걸러내고([0004](0004-graphql-socketio-api-layer-split.ko.md) 참고),
`ChatResolver`는 각 메시지가 커밋된 뒤 `ModerationService.evaluateMessage()`를 호출합니다.
여기서 `ModerationModule`까지 `ChatModule`을 임포트하면(예: 경고/뮤트/차단 알림을 룸에 발행하거나
제재 시 소켓을 끊기 위해) NestJS 모듈 사이클이 생깁니다.

## 결정

`ModerationModule`은 절대 `ChatModule`을 임포트하지 않습니다. `ModerationService`는 필요한 채팅
쪽 효과(`publishFn`, `disconnectFn`)를 주입받은 채팅 서비스에서 얻는 게 아니라, 호출 시점에
`ChatResolver`가 넘겨주는 콜백으로 받습니다. `AiService.handleReply()`가 같은 이유로 이미 쓰고
있는 패턴 그대로입니다. `backend/src/moderation/moderation.module.ts:1-4`에 문서화되어 있고,
실제 콜백 형태는 `moderation.service.ts:39-43`의 `ModerationCallbacks`입니다.
- 고려했다가 배제한 대안:
  - **`ModerationModule`이 `ChatModule`을 직접 임포트**: 위 배경 절이 이미 반박하는
    대안입니다. 이 ADR이 피하려는 바로 그 모듈 사이클(`Chat → Moderation → Chat`)이 생기고,
    `AiService`로 이미 검증된 콜백 패턴에 비해 얻는 것도 없습니다.
  - **콜백 주입 대신 이벤트 이미터**(예: NestJS의 `EventEmitter2`): `ModerationService`가
    도메인 이벤트(`moderation.mute`, `moderation.ban`)를 발행하고 `ChatModule`이 구독하는
    방식으로, 어느 방향으로도 직접 임포트가 없어집니다. 지금은 배제했습니다. 이 코드베이스
    어디에도 없는 새 아키텍처 패턴을 들여오는 일인데, 콜백 주입 패턴(여기와 `AiService` 두
    곳에서 이미 검증됨)이 더 낮은 비용으로 같은 문제를 이미 풀고 있기 때문입니다.

## 결과

- "편의를 위해" `ModerationModule`에 `ChatModule`을 임포트하는 것은 절대 제안하지 않습니다.
  이 패턴이 애초에 피하려던 사이클을 도로 만드는 일입니다.
- 앞으로 `ChatModule` 밖에서 채팅 룸에 작용해야 하는 모듈(예: 새로운 자동 모더레이션류 기능)이
  생기면, 이 패턴이 맞지 않는 구체적인 이유가 없는 한 새 모듈 간 임포트가 아니라 이 콜백 주입
  패턴을 기본으로 삼아야 합니다.
- 트레이드오프: 채팅 쪽 효과가 필요한 `ModerationService`의 공개 메서드(예: `evaluateMessage`)는
  `ModerationCallbacks` 형태의 파라미터를 반드시 받아야 하므로, 호출자가 챙길 파라미터가 하나
  늘어납니다. DI 레벨에서 `ChatModule`에 의존하지 않는 대가로 의도적으로 받아들인
  트레이드오프입니다.
