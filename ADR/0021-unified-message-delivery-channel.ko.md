# 0021: 사람·AI·모더레이션 시스템 메시지의 단일 전달 채널/형태

## 상태

Accepted

## 배경

`sendMessage`는 사람이 보낸 메시지를 `receiveMessage :${roomId}`로 발행합니다(`chat.resolver.ts:206-208`).
그런데 같은 룸에 메시지를 전달해야 하는 자동화된 소스가 두 개 더 있습니다. AI 동반자
답장(`AiService.handleReply()`)과 모더레이션 시스템 알림(경고/뮤트/차단 문구,
`ModerationService.sendSystemMessage()` 경유)입니다. 공유된 규칙이 없으면 새 자동화 소스가
생길 때마다 각자 자기만의 전달 경로(두 번째 GraphQL 필드, 직접 Socket.IO emit, 다른 pub/sub
채널)를 만들 수 있고, 그러면 프론트엔드가 발신자 유형별로 렌더링을 분기해야 합니다.

## 결정

모든 메시지 소스 — 사람, AI, 모더레이션 — 는 동일한
`pubSub.publish(`receiveMessage :${roomId}`, { receiveMessage: msg })` 호출과 `ChatEntity`
형태의 페이로드로 발행합니다.

- 사람: `chat.resolver.ts:206-208`, `sendMessage` 리졸버 안에 인라인으로.
- AI: `chat.resolver.ts:285-289`, 커밋 이후 `ChatResolver`가 `AiService.handleReply()`에
  넘겨주는 `publishFn` 콜백을 통해([ADR 0007](0007-ai-reply-distributed-lock.ko.md)이 이
  호출을 감싸는 룸 단위 락을 다루고, 이 ADR은 전달 형태만 다룹니다).
- 모더레이션: `chat.resolver.ts:240-243`, `ModerationService.evaluateMessage()`에 넘겨주는
  동일한 `publishFn` 콜백을 통해. `ModerationService.sendSystemMessage()`(`moderation.service.ts:320-339`)가
  먼저 그 알림을 실제 `ChatEntity` 행으로 저장한 뒤(AI 메시지와 동일하게 시스템 유저 명의)
  발행합니다. 저장되지 않는 일시적 브로드캐스트가 아닙니다.

세 소스 중 어느 것도 코드베이스 어디에도 두 번째 전달 메커니즘을 갖고 있지 않습니다. 채널
하나, 형태 하나, 발신자 유형 분기 없는 프론트엔드 렌더링 경로 하나입니다.

**고려했다가 배제한 대안:**

- **소스별 전용 채널이나 GraphQL 구독**(예: `receiveMessage`와 별개인 `systemNotice :${roomId}`):
  배제했습니다. 프론트엔드가 구독을 하나 더 열고 두 스트림의 병합/순서 전략까지 세워야 하며,
  결국 같은 룸의 메시지일 뿐인 것들을 렌더링하려고 모든 클라이언트가 발신자 유형으로 분기해야
  합니다.
- **모더레이션 알림을 Socket.IO로 전달**(`ChatGateway`에 이미 사용자별 소켓이 있으므로):
  배제했습니다. 메시지 전달이 두 전송 계층으로 쪼개지는데, 이는
  [0004](0004-graphql-socketio-api-layer-split.ko.md)가 벗어나려고 마이그레이션했던 바로 그
  이중 경로 복잡성입니다.
- **모더레이션 알림을 저장하지 않고 발행만 하기**(일시적 토스트 형태의 알림): 배제했습니다.
  새로고침하거나 커서 기반 이력을 거슬러 올라가면 알림이 사라져서, 사용자가 왜 경고를
  받았는지에 대한 기록이 남지 않습니다. 먼저 저장하면 사람 메시지와 똑같이 살아남습니다.

## 결과

- 새로운 자동화/시스템 메시지 소스(향후의 모더레이션 액션 유형, 봇, 예약 공지 등)는 반드시 이
  "`publishFn` 콜백을 `ChatResolver`에서 넘겨받는" 동일한 형태로 발행해야 합니다. 메시지
  전달을 위한 두 번째 GraphQL 필드, REST 엔드포인트, 직접 Socket.IO emit은 절대 도입하면
  안 됩니다. 이 문제의 *모듈 의존성* 쪽 측면(왜 직접 서비스 import가 아니라 콜백인지)은
  [ADR 0006](0006-moderation-one-directional-dependency.ko.md)을 참고하세요.
- Redis Pub/Sub는 최대 한 번 전달입니다([ADR 0004](0004-graphql-socketio-api-layer-split.ko.md)).
  사람 메시지뿐 아니라 AI·모더레이션 메시지에도 똑같이 적용됩니다. 발행 시점에 연결이 끊긴
  구독자는 모더레이션 경고도 사람 메시지와 마찬가지로 재전송 없이 영구히 놓칩니다.
- 모더레이션 시스템 메시지는 (일시적 알림과 달리) 발행되기 *전에* `ChatEntity`로 저장되므로,
  페이지 새로고침이나 커서 기반 이력 조회에서도 사람 메시지와 동일하게 살아남습니다.
  `chatRepository.save()` 없이 발행만 하는 모더레이션 알림은 절대 제안하지 않습니다. 그러면
  다음 이력 조회 때 조용히 사라집니다.
