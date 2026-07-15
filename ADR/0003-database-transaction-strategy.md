# 0003: PostgreSQL + TypeORM transaction strategy

## Status

Accepted

## Context

Several write paths touch more than one table (e.g. `sendMessage` may create a `RoomEntity` and always
saves a `ChatEntity`; `updateRole` reads and mutates role-population invariants under concurrency). A
partial write on failure would orphan data; concurrent role mutations without isolation could produce
phantom reads that violate the "at least one superadmin" / "at most `MAX_ADMIN_COUNT` admins" invariants.

## Decision

- `synchronize: false` always — schema changes only via `pnpm migration:generate` /
  `pnpm migration:run`, never runtime auto-alteration.
- GraphQL mutations with multiple writes use `GqlTransactionInterceptor` +
  `@GqlQueryRunnerDecorator()` — the interceptor opens the `QueryRunner` before the resolver runs and
  commits it *after* the resolver returns; anything that depends on durability (e.g. the AI reply
  trigger) awaits `ctx.req.transactionCommitted` rather than assuming the commit already happened.
  `GqlExecutionContext.create()` is required instead of `ctx.switchToHttp()` here because GraphQL
  requests don't expose the transaction-bearing request object through the HTTP context
  (`gql-transaction.interceptor.ts:5-6`). Currently the only consumer is `sendMessage`.
- Service-level ACID outside GraphQL (e.g. `UserService.updateRole`) uses
  `dataSource.transaction('SERIALIZABLE', callback)` — TypeORM manages begin/commit/rollback.
  `SERIALIZABLE` is used specifically here to prevent phantom reads during concurrent role-mutation
  checks (the last-superadmin and `MAX_ADMIN_COUNT` invariants); it is not applied elsewhere by default
  because of its serialization/retry overhead under contention.
- Manual `createQueryRunner → connect → startTransaction → commit/rollback → release` inline in a
  method is never used — one of the two patterns above always owns the lifecycle.

## Consequences

- Never suggest `synchronize: true`, even for "just this once in dev" — it risks the same data-loss
  class of bug regardless of environment intent.
- Any new handler with more than one repository write must pick one of the two transaction patterns
  above at design time, not discover the need after a partial-write bug appears.
- `migration:generate` re-emits a spurious FK drop/re-add on
  `room_entity_participants_user_entity` (its ManyToMany relation carries no `onDelete`) — those FK
  lines must be stripped from every generated migration, keeping only the intended column change, or
  `UserService.remove`'s cascade-delete behavior silently breaks.
