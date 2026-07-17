# 0003: PostgreSQL + TypeORM 트랜잭션 전략

## 상태

Accepted

## 배경

여러 쓰기 경로가 두 개 이상의 테이블을 건드립니다(예: `sendMessage`는 `RoomEntity`를 새로 만들 수도
있고 항상 `ChatEntity`를 저장합니다; `updateRole`은 동시성 상황에서 역할 분포 불변식을 읽고
변경합니다). 실패 시 부분 쓰기가 일어나면 데이터가 고아 상태가 되고, 격리 없이 동시에 역할을 변경하면
"최소 한 명의 superadmin 유지" / "admin은 최대 `MAX_ADMIN_COUNT`명까지" 불변식을 깨는 팬텀 리드가
발생할 수 있습니다.

## 결정

- `synchronize: false`를 항상 유지합니다 — 스키마 변경은 오직 `pnpm migration:generate` /
  `pnpm migration:run`을 통해서만 하며, 런타임 중 자동 변경은 절대 하지 않습니다.
- 여러 번 쓰는 GraphQL 뮤테이션은 `GqlTransactionInterceptor` + `@GqlQueryRunnerDecorator()`를
  사용합니다 — 인터셉터가 리졸버 실행 전에 `QueryRunner`를 열고, 리졸버가 반환된 *이후*에 커밋합니다.
  내구성(durability)에 의존하는 로직(예: AI 답장 트리거)은 커밋이 이미 끝났다고 가정하지 말고
  `ctx.req.transactionCommitted`를 await해야 합니다. `GqlExecutionContext.create()`가
  `ctx.switchToHttp()` 대신 필요한 이유는, GraphQL 요청이 트랜잭션을 담은 request 객체를 HTTP
  컨텍스트로 노출하지 않기 때문입니다(`gql-transaction.interceptor.ts:5-6`). 현재 유일한
  사용처는 `sendMessage`입니다.
- GraphQL 밖에서의 서비스 레벨 ACID(예: `UserService.updateRole`)는
  `dataSource.transaction('SERIALIZABLE', callback)`을 사용합니다 — TypeORM이 begin/commit/rollback을
  관리합니다. `SERIALIZABLE`은 동시 역할 변경 검사(최후의 superadmin, `MAX_ADMIN_COUNT` 불변식)
  중 팬텀 리드를 막기 위해 특별히 여기서만 사용하며, 경합 상황에서의 직렬화/재시도 오버헤드 때문에
  다른 곳에는 기본값으로 적용하지 않습니다.
- 메서드 안에서 `createQueryRunner → connect → startTransaction → commit/rollback → release`를
  수동으로 인라인 처리하는 방식은 절대 쓰지 않습니다 — 위 두 패턴 중 하나가 항상 생명주기를
  소유합니다.

## 결과

- `synchronize: true`는 "이번 개발 환경에서만 잠깐"이라도 절대 제안하지 않습니다 — 환경 의도와
  무관하게 동일한 데이터 손실 유형의 버그 위험이 있습니다.
- 두 개 이상의 리포지토리 쓰기가 있는 새 핸들러는 설계 시점에 위 두 트랜잭션 패턴 중 하나를 반드시
  선택해야 하며, 부분 쓰기 버그가 나타난 뒤에 뒤늦게 필요성을 발견하면 안 됩니다.
- `migration:generate`는 `room_entity_participants_user_entity`에 대해 근거 없는 FK
  drop/re-add를 다시 만들어냅니다(해당 ManyToMany 관계에는 `onDelete`가 없기 때문입니다) — 이
  FK 라인들은 생성된 모든 마이그레이션에서 제거하고 의도한 컬럼 변경만 남겨야 하며, 그렇지 않으면
  `UserService.remove`의 캐스케이드 삭제 동작이 조용히 깨집니다.
