# 0003: PostgreSQL + TypeORM 트랜잭션 전략

## 상태

Accepted

## 배경

두 개 이상의 테이블을 건드리는 쓰기 경로가 여럿 있습니다. 예를 들어 `sendMessage`는 `ChatEntity`를
항상 저장하고 경우에 따라 `RoomEntity`도 새로 만들며, `updateRole`은 동시성 상황에서 역할 분포
불변식을 읽고 변경합니다. 이런 경로에서 실패 시 일부만 쓰이면 데이터가 고아 상태로 남고, 격리
없이 역할을 동시에 변경하면 팬텀 리드 때문에 "superadmin은 최소 한 명 유지" / "admin은 최대
`MAX_ADMIN_COUNT`명까지" 불변식이 깨질 수 있습니다.

## 결정

- `synchronize: false`를 항상 유지합니다. 스키마 변경은 오직 `pnpm migration:generate` /
  `pnpm migration:run`으로만 하며, 런타임 중 자동 변경은 절대 허용하지 않습니다.
- 쓰기가 여러 번인 GraphQL 뮤테이션은 `GqlTransactionInterceptor` + `@GqlQueryRunnerDecorator()`를
  사용합니다. 인터셉터가 리졸버 실행 전에 `QueryRunner`를 열고, 리졸버가 반환된 *이후*에
  커밋합니다. 따라서 커밋의 내구성(durability)에 의존하는 로직(예: AI 답장 트리거)은 커밋이 이미
  끝났다고 가정하지 말고 `ctx.req.transactionCommitted`를 await해야 합니다.
  `GqlExecutionContext.create()`가 `ctx.switchToHttp()` 대신 필요한 이유는, GraphQL 요청이
  트랜잭션을 담은 request 객체를 HTTP 컨텍스트로 노출하지 않기
  때문입니다(`gql-transaction.interceptor.ts:5-6`). 현재 유일한 사용처는 `sendMessage`입니다.
- GraphQL 밖의 서비스 레벨 ACID(예: `UserService.updateRole`)는
  `dataSource.transaction('SERIALIZABLE', callback)`을 사용하며, begin/commit/rollback은 TypeORM이
  관리합니다. `SERIALIZABLE`은 동시 역할 변경 검사(최후의 superadmin, `MAX_ADMIN_COUNT` 불변식)에서
  팬텀 리드를 막기 위해 여기에만 적용합니다. 경합 시 직렬화/재시도 오버헤드가 있으므로 다른 곳에
  기본값으로 쓰지 않습니다.
- 메서드 안에서 `createQueryRunner → connect → startTransaction → commit/rollback → release`를
  수동으로 인라인 처리하는 방식은 절대 쓰지 않습니다. 트랜잭션 생명주기는 항상 위 두 패턴 중
  하나가 소유합니다.
- 고려했다가 배제한 대안:
  - **여러 쓰기 지점마다 `QueryRunner` 생명주기를 수동으로 인라인 처리**: 배제했습니다. 필요한
    곳마다 같은 open/commit/rollback/release 보일러플레이트가 반복되고, `release()`를 한 번만
    빠뜨려도 커넥션 풀에서 커넥션이 새어나갑니다(Never Do Group 1이 지목하는 바로 그 버그
    유형입니다).
  - **다중 쓰기가 아닌 것까지 포함해 모든 GraphQL 뮤테이션을 기본적으로 트랜잭션으로 감싸기**:
    배제했습니다. 대부분의 뮤테이션은 단일 쓰기라 트랜잭션으로 감싸도 얻는 게 없고, 무조건
    감싸면 필요 없는 뮤테이션에까지 커넥션 풀 부하만 더해집니다.
  - **`updateRole`뿐 아니라 `GqlTransactionInterceptor`가 적용되는 모든 곳에 `SERIALIZABLE`
    격리 수준 사용**: 배제했습니다. `SERIALIZABLE`의 충돌 시 재시도 오버헤드는 팬텀 리드가
    실제로 불변식을 깨는 곳(superadmin/`MAX_ADMIN_COUNT` 검사)에서만 정당화됩니다.
    `sendMessage`에 적용하면 정합성 이득 없이 경합 비용만 추가됩니다.

## 결과

- `synchronize: true`는 "이번 개발 환경에서만 잠깐"이라도 절대 제안하지 않습니다. 어느 환경을
  의도했든 동일한 데이터 손실 유형의 버그 위험이 있습니다.
- 리포지토리 쓰기가 두 개 이상인 새 핸들러는 설계 시점에 위 두 트랜잭션 패턴 중 하나를 반드시
  골라야 합니다. 부분 쓰기 버그가 터진 뒤에야 필요성을 발견해서는 안 됩니다.
- `migration:generate`는 `room_entity_participants_user_entity`에 대해 근거 없는 FK drop/re-add를
  매번 다시 만들어냅니다(해당 ManyToMany 관계에 `onDelete`가 없기 때문입니다). 생성된 모든
  마이그레이션에서 이 FK 라인들을 제거하고 의도한 컬럼 변경만 남겨야 합니다. 그러지 않으면
  `UserService.remove`의 캐스케이드 삭제가 조용히 깨집니다.
