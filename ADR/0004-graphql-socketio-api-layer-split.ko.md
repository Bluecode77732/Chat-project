# 0004: 데이터는 GraphQL, 연결 생명주기는 Socket.IO 전용

## 상태

Accepted

## 배경

실시간 채팅은 메시지에 대한 트랜잭션 안전 쓰기 경로와, 지연이 낮은 연결 관리(접속 시 인증, 룸
join/leave, 세션 충돌 시 강제 로그아웃) 둘 다가 필요합니다. README의
[Stacks](../README.md#stacks) 절에 따르면, 메시지는 원래 순수 Socket.IO로 직접 전송되었다가
프로젝트 중반에 GraphQL로 옮겨졌는데, 이는 순수 소켓 핸들러가 줄 수 없는 트랜잭션 보장을 얻기
위해서였습니다([0003](0003-database-transaction-strategy.ko.md) 참고).

## 결정

- 모든 채팅 메시지는 `sendMessage` GraphQL 뮤테이션과 `receiveMessage` GraphQL 구독(`roomId`
  기준)을 통해서만 흐릅니다 — 이것이 유일한 메시지 전달 경로입니다.
- `ChatGateway`(Socket.IO)는 정확히 세 가지만 처리합니다: 연결 인증(`handleConnection` /
  `handleDisconnect`), 새 룸이 생성될 때 `CreateRoom` 이벤트 푸시, 세션 충돌 시 `forceLogout`.
  채팅 메시지를 위한 `@SubscribeMessage` 핸들러는 없고, 메시지를 emit하지도 않습니다.
- AI가 생성한 답장과 앞으로 추가될 모든 자동/시스템 메시지 소스는 사람이 보낸 메시지와 동일한
  `receiveMessage :${roomId}` 채널과 형태로 발행됩니다(`chat.resolver.ts:284-289` vs `:206`) —
  전달 경로는 하나뿐이며, 클라이언트에서 발신자 유형별 분기가 없습니다.
- Redis Pub/Sub(`graphql-redis-subscriptions`)는 `receiveMessage`에 대해 최대 한 번(at-most-once)
  전달을 제공합니다 — 발행 시점에 연결되어 있지 않은 구독자는 그 메시지를 영구히 놓치며, 재전송은
  없습니다.
- 고려했다가 배제한 대안:
  - **메시지 전송을 순수 Socket.IO에 그대로 두는 것**(마이그레이션 이전 상태): 배제 — 순수 소켓
    핸들러로는 `GqlTransactionInterceptor`가 룸 생성+메시지 저장 쓰기에 제공하는 ACID 보장을 얻을
    방법이 없습니다([0003](0003-database-transaction-strategy.ko.md) 참고) — 이건 가상의 비교가
    아니라 실제로 이 마이그레이션이 일어난 이유입니다.
  - **두 경로를 동시에 운영**(GraphQL 뮤테이션과 나란히 Socket.IO 메시지 이벤트도 유지): 배제 —
    프론트엔드가 같은 이벤트의 두 소스를 조율해야 하고 중복/순서 뒤바뀜 전달 위험이 생깁니다.
    CLAUDE.md에도 명시적으로 Never Do로 적혀 있습니다.
  - **Redis Pub/Sub 대신 영구 큐(예: BullMQ)**: 일반적인 경우엔 배제 — 워커 프로세스, 작업 보존
    정책 같은 운영 복잡도가 추가되는데, 라이브 채팅에서 최대 한 번 전달을 놓치는 건 "연결 끊긴
    동안 메시지를 못 봄" 정도지 비즈니스 이벤트 유실이 아닙니다. 나중에 보장된 전달이 실제로
    필요한 유스케이스가 생겼을 때를 위한 답으로 문서에 남겨두는 것이지, 지금 채택하는 건
    아닙니다.

## 결과

- 이미 GraphQL 인프라가 있는 곳에 REST 컨트롤러를 추가하거나, 같은 이벤트에 Socket.IO와 GraphQL
  구독을 함께 쓰는 것은 절대 제안하지 않습니다 — 이 마이그레이션이 없애려고 했던 이중 경로의 복잡성을
  다시 만들어버립니다.
- 새로운 자동/시스템 메시지 소스는 반드시 기존 `PubSubService.publish()` 채널을 통해 발행해야 하며,
  두 번째 전달 메커니즘을 새로 만들면 안 됩니다.
- 보장된(최대 한 번이 아닌) 전달이 필요한 유스케이스는 그 위에 영구 큐(예: BullMQ)를 얹어야 합니다 —
  Redis Pub/Sub만으로는 그 요구사항을 충족할 수 없으며, 이는 라이브 채팅에서는 실수가 아니라 받아들인
  한계입니다.
