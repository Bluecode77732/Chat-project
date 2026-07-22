# 0002: ioredis를 통한 Redis 캐시 키/TTL 컨벤션

## 상태

Accepted

## 배경

이 앱에는 세 가지가 필요합니다. 백엔드 인스턴스가 여러 개(수평 확장)여도 동일하게 동작하는
공유 캐시/세션 계층, GraphQL 뮤테이션을 GraphQL 구독으로 이어주는 pub/sub 브리지, 그리고
인스턴스가 여러 개여도 Socket.IO 룸 브로드캐스트가 일관되게 동작하게 하는 메커니즘입니다.

## 결정

- 클라이언트 라이브러리는 `ioredis` 하나로 코드베이스 전체에서 통일합니다(`redis.module.ts`).
- 키 이름은 `{service}:{entity}:{id}` 컨벤션을 따릅니다. 예: `chat:session:userId`,
  `moderation:strike:{userId}`(`moderation.constants.ts`).
- 모든 키는 쓰는 시점에 TTL을 겁니다. 무기한 캐시는 두지 않습니다. `user_cache:{userId}`
  (`USER_CACHE_TTL_SEC`, 기본 300초, `jwt.strategy.ts`에서 설정)는 여기에 더해 `updateRole`
  (`user.service.ts:290`) 이후 명시적으로 무효화됩니다. 앞으로 사용자 역할을 바꾸는 경로를
  새로 만들 때도 똑같이 `redis.del(\`user_cache:${userId}\`)`를 호출해야 합니다. 빠뜨리면
  TTL이 만료될 때까지 권한 상승 창이 열려 있게 됩니다.
- pub/sub은 발행자 연결과 분리된 전용 구독자 연결을 사용합니다. 이 연결은
  `graphql/pubsub.service.ts`에서 인라인으로 생성됩니다.
- `@socket.io/redis-adapter`가 `ChatGateway`를 Redis에 연결해서(`chat.gateway.ts:64`), 서버
  인스턴스가 둘 이상이어도 룸 멤버십과 브로드캐스트가 올바르게 동작합니다. 어댑터가 없으면
  `server.to(socketId).emit(...)`은 같은 프로세스에 붙은 클라이언트에게만 도달합니다.
- 리소스 단위 동시성 가드도 동일한 acquire-with-NX/TTL 패턴을 따릅니다. 예:
  `AiService.handleReply()`의 `ai:lock:{roomId}` 락(`SET ... EX 30 NX`, `finally` 블록에서 해제).
- 고려했다가 배제한 대안:
  - **`ioredis` 옆에 두 번째 클라이언트(`node-redis`)를 두는 것**: 일부러 검토한 대안이
    아니라 실제로 실수로 벌어졌던 일입니다. 사용되지 않은 채 발견된 `redis` v5 의존성 사례는
    [ARCHITECTURE.md](../ARCHITECTURE.md#resolved-anomaly)를 참고하세요. 이 컨벤션이 막으려는
    혼란("어느 클라이언트가 정본인가?")의 구체적 사례로 여기 남겨둡니다.
  - **네이밍 컨벤션 없는 자유 형식 키**: 배제했습니다. `{service}:{entity}:{id}` 형태를
    공유하지 않으면, 키 충돌을 찾거나 어떤 키에 어떤 TTL이 걸려 있는지 점검할 때 모든
    호출부를 일일이 읽어야 합니다.
  - **TTL 대신 별도 스케줄 정리 작업**: 배제했습니다. 운영해야 할 프로세스가 하나 늘어나고,
    정리 작업이 도는 사이에는 메모리가 무한정 증가할 수 있는 창이 여전히 남습니다. 쓰기
    시점에 원자적으로 TTL을 거는 방식에는 별도 프로세스도, 그런 창도 없습니다.

## 결과

- `node-redis`는 절대 제안하지 않습니다. 이 코드베이스에서 쓰는 클라이언트는 `ioredis`
  하나뿐이며, 두 번째 클라이언트가 들어오면 어느 쪽이 정본인지에 대한 혼란이 생깁니다 —
  실제로 한 번 일어났던 일입니다(사용되지 않는 `redis` v5 의존성이 발견된 사례는
  [ARCHITECTURE.md](../ARCHITECTURE.md#resolved-anomaly) 참고).
- 새로 추가하는 모든 Redis 키는 네이밍 컨벤션을 따르고 명시적 TTL을 가져야 합니다. TTL 없는
  키는 Never Do Group 3 위반(무한정 메모리 증가)입니다.
- 사용자별 실시간 등록이나 리소스별 백그라운드 작업을 새로 만들 때는 여기 정립된 무효화/락
  패턴을 그대로 써야 합니다. "이 경우는 다르니까 괜찮다"는 가정은 하지 않습니다.
