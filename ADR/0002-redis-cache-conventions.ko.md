# 0002: ioredis를 통한 Redis 캐시 키/TTL 컨벤션

## 상태

Accepted

## 배경

이 앱은 여러 백엔드 인스턴스(수평 확장)에서 동일하게 동작하는 공유 캐시/세션 계층과, GraphQL
뮤테이션에서 GraphQL 구독으로 이어지는 pub/sub 브리지, 그리고 여러 인스턴스에서도 Socket.IO 룸
브로드캐스트가 일관되게 동작하도록 하는 메커니즘이 필요합니다.

## 결정

- 클라이언트 라이브러리: `ioredis`, 코드베이스 전체에서 통일해서 사용합니다(`redis.module.ts`).
- 키 네이밍 컨벤션: `{service}:{entity}:{id}` — 예: `chat:session:userId`,
  `moderation:strike:{userId}`(`moderation.constants.ts`).
- 모든 키는 쓰는 시점에 TTL을 가집니다 — 무기한 캐시는 없습니다. `user_cache:{userId}`
  (`USER_CACHE_TTL_SEC`, 기본 300초, `jwt.strategy.ts`에서 설정)는 `updateRole`
  (`user.service.ts:290`) 이후 추가로 명시적으로 무효화됩니다 — 앞으로 사용자 역할을 변경하는 어떤
  경로도 동일하게 `redis.del(\`user_cache:${userId}\`)`를 호출해야 하며, 그렇지 않으면 TTL만큼의
  권한 상승 창이 열립니다.
- pub/sub은 발행자 연결과 별도의 전용 구독자 연결을 사용하며, `graphql/pubsub.service.ts`에서 인라인으로
  생성됩니다.
- `@socket.io/redis-adapter`가 `ChatGateway`를 Redis에 연결해서(`chat.gateway.ts:64`) 서버
  인스턴스가 둘 이상이어도 룸 멤버십/브로드캐스트가 올바르게 동작합니다 — 이게 없으면
  `server.to(socketId).emit(...)`은 같은 프로세스에 붙은 클라이언트에게만 도달합니다.
- 리소스 단위 동시성 가드(예: `AiService.handleReply()`의 `ai:lock:{roomId}` 락,
  `SET ... EX 30 NX`, `finally` 블록에서 해제)도 동일한 acquire-with-NX/TTL 패턴을 따릅니다.

## 결과

- `node-redis`는 절대 제안하지 않습니다 — 이 코드베이스 전체에서 사용되는 클라이언트는 `ioredis`
  하나뿐이며, 두 번째 클라이언트를 들이면(실제로 이미 실수로 한 번 일어난 일입니다 — 사용되지 않는
  `redis` v5 의존성이 플래그된 사례는 [ARCHITECTURE.md](../ARCHITECTURE.md#resolved-anomaly)
  참고) 어느 클라이언트가 정본인지에 대한 혼란이 생깁니다.
- 새로 추가되는 모든 Redis 키는 네이밍 컨벤션을 따르고 명시적인 TTL을 가져야 합니다. TTL이 없는 키는
  Never Do Group 3 위반(무한정 메모리 증가)입니다.
- 새로운 사용자별 실시간 등록이나 리소스별 백그라운드 작업은 반드시 여기 이미 정립된 무효화/락 패턴을
  그대로 적용해야 하며, "이 경우는 다르니까 괜찮다"고 가정하면 안 됩니다.
