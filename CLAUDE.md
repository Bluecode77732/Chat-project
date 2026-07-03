# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hallucination Prevention (환각 방지)

Before making any change:
1. Inspect the codebase thoroughly — read the relevant files, grep for symbols, trace the actual call chain.
   Concern-to-entrypoint map (check these first):
   - Auth flow change    → read `backend/src/auth/`; grep `JwtAuthGuard`, `RbacGuard`
   - Chat/WS change      → trace `backend/src/chat/chat.gateway.ts` → `chat.service.ts`; for `sendMessage` transactions see `GqlTransactionInterceptor`
   - Redis change        → read `backend/src/redis/redis.service.ts` (SessionCacheService) and `backend/src/graphql/pubsub.service.ts` (pub/sub subscriber connection); check pub/sub channel names
   - GraphQL schema      → read `backend/src/schema.gql` before adding any type or field
   - Frontend auth       → read `frontend/src/api/apollo.ts` (errorLink) and `frontend/src/socket/socket.ts` (reconnectSocket)
2. Never invent APIs, files, functions, or types that you have not confirmed exist in the codebase.
3. Reuse existing patterns only; do not introduce new abstractions unless explicitly asked.
4. Verify every assumption with actual code, search results, or test output — not memory or inference alone.
5. Run `pnpm lint` and `pnpm test` (or the relevant subset) before claiming success.
6. Show the exact diff of changes made, not a paraphrase.
7. Explicitly state all uncertainties instead of guessing — say "I'm not sure" and propose a verification step.

## Scope Discipline (범위 준수)

Do not make any of the following unless explicitly requested:
- Unrelated refactors or code cleanups
- Architectural changes
- New dependency additions — confirm via pnpm before installing
- Schema or migration changes — if an entity change is needed, describe the required column/relation in plain text and stop. Never run `pnpm migration:generate`.
- Large-scale formatting edits

High-blast-radius files — require explicit approval before any edit:
`app.module.ts`, `*.entity.ts`, `*.interceptor.ts`, `backend/src/schema.gql`

Touching any of the following always counts as "beyond the stated task":
AppModule providers array, EntityBase, shared guards, `graphql/pubsub.service.ts`

If a change requires touching files beyond the stated task, list all affected files first and wait for approval.
Stick strictly to the stated task.

## Clarification Protocol

Before implementing anything non-trivial, ask the one question that applies:

| Trigger                               | Ask                                                                                |
|---------------------------------------|------------------------------------------------------------------------------------|
| New handler (Gateway or Resolver)     | Does this need `@UseInterceptors(GqlTransactionInterceptor)` (GraphQL mutations only — Socket.IO carries no chat-message traffic)? |
| New Guard                             | Where in the `JwtAuthGuard → RbacGuard → handler` chain does this sit?            |
| New Redis key                         | What TTL and does it follow `{service}:{entity}:{id}` naming?                     |
| New GraphQL type or field             | Will this conflict with existing types in `schema.gql`?                            |
| Frontend auth flow change             | Does `apollo.ts` errorLink, `axios.ts` interceptor, `protected-route.tsx`, or `socket.ts` reconnectSocket need a parallel update via `auth/session-guard.ts`? |

Ask one focused question rather than a list. Do not proceed on assumptions when intent is ambiguous.

## Analysis Protocol (분석)

### Introduction Analysis (도입)
When a new tool, library, or concept is being introduced, always cover the following before writing any code:
- Background: why it was created and what problem it solves
- Implementation purpose: what specific goal it serves in this context
- Practical disadvantages if not implemented, and the root causes of those disadvantages

Do not write excessive code during this phase.

### Structure Analysis (구조)
When planning an implementation, answer the following before proceeding:
- What overall structure will this create, end to end?
- Does the current structure and plan align with general web development principles?
- Provide a detailed breakdown: overall architecture, page flow, data flow, etc.
- What is the core relationship between this implementation and the existing project?
- If a relationship exists, what is the concrete, practical impact of that relationship?

  Project structure checklist:
  - Does this add a NestJS provider? → which module's `providers[]` needs it?
  - Does this change transaction scope? → GraphQL mutations use `@UseInterceptors(GqlTransactionInterceptor)` + `@GqlQueryRunnerDecorator()`; there is no REST or WS equivalent (Socket.IO carries no chat-message traffic)
  - Does this modify the GraphQL schema? → restart server to regenerate `schema.gql`, then diff it

### Modification Analysis (수정)
For each change being made, explicitly state:
- What does this change mean in plain terms?
- What is the purpose of implementing it?
- Why is it being implemented at this stage specifically?
- Does it fit the existing design structure — verify and list the reasons it does or does not.

  Service-level impact:
  - `ChatService` change → check `chat.service.spec.ts` for broken mocks
  - `AuthService` change → check `auth.service.spec.ts`; verify guard chain still holds
  - `SessionCacheService` change → verify all Redis hash field names remain consistent

### Result Review (결과 검토)
After completing any implementation, apply the review perspective that matches what was just done.

**After an Introduction:**
- Did this tool/library actually solve the problem it was introduced to solve?
- Is the implementation purpose clearly reflected in the result?
- Would skipping this still cause the practical disadvantages described earlier?

**After a Structure change:**
- Does the implemented structure match the plan that was laid out?
- Is it consistent with existing patterns in the codebase?
- Does the data flow and page flow behave as designed?

**After a Modification:**
- Do the changes work correctly? Run `pnpm lint` and `pnpm test` to verify.
  - Socket.IO handler changed → verify `handleConnection` and `handleDisconnect` are symmetric (every `socket.on` in connect must have a matching `socket.off` in disconnect)
  - `apollo.ts` changed → verify split link still routes: subscription → `wsLink`, rest → `errorLink → authLink → httpLink`
  - Redis key added → confirm TTL is set and key follows `{service}:{entity}:{id}` naming
- Are there any regressions in existing functionality?
- What side effects or hidden risks does this change introduce?
- Is the change isolated enough, or does it bleed into unrelated areas?

## Change Summary

After completing any task, always append a brief summary in this format:

```
## Change Summary
- What changed: <one line per file or concern>
- Why: <the stated reason>
- Side effects: <impact on: schema.gql / Redis key set / guard chain / frontend graphql-operations.ts>
- Guard chain impact: <any change to guard order or new guard added — list affected endpoints; omit if no guard was touched>
- Pending: <anything deferred, left incomplete, or requiring follow-up>
```

## File Creation Convention

When creating a new file (not when editing an existing one), add a short header
comment above the imports stating:
- Purpose: why this file exists (the gap it fills)
- Usage: who/what is expected to import or call into it
- Rationale: why it was added now, or why an existing file could not absorb this

```typescript
// Purpose: isolates Redis lock acquisition for per-room AI replies.
// Usage: imported by AiService.handleReply(); not intended for direct use elsewhere.
// Rationale: lock logic was inline in ai.service.ts and untestable in isolation.

import ...
```

Keep it to three lines, one per field — no exceptions for "obvious" files. This is the
one place a header comment is required regardless of how self-explanatory the file
seems. Do not retroactively add this header to existing files being edited.

## Never Do — Forbidden Patterns
These patterns defeat the purpose of TypeScript and cause production failures.
Violations are grouped by failure class.

### GROUP 1 — Runtime Crash

Patterns that pass compilation but crash at runtime — they nullify the reason for using TypeScript.

```typescript
// ❌ Non-null assertion → Cannot read properties of null
user!.email
// ✅
if (!user) throw new Error('user is null');
user.email

// ❌ Type casting bypasses type checker → wrong type propagates to DB
const req = context.req as AuthRequest
// ✅
if (!isAuthRequest(req)) throw new UnauthorizedException()

// ❌ any — type errors silently pass through refactors
parse(data: any)
// ✅
parse(data: unknown) // narrow with typeof / instanceof

// ❌ @ts-ignore without explanation — masks real errors
// @ts-ignore
// ✅
// @ts-expect-error: upstream type mismatch in graphql-ws v5, tracked in #123

// ❌ Empty catch — swallows errors, invisible in Sentry
try { ... } catch (e) {}
// ✅
catch (e) { this.logger.error(e); throw e; }

// ❌ Floating promise → unhandledRejection crashes process
publishMessage()
// ✅
await publishMessage()

// ❌ JSON.parse without try/catch → immediate crash on bad input
JSON.parse(rawBody)
// ✅
try { JSON.parse(rawBody) } catch { throw new BadRequestException() }

// ❌ Synchronous blocking → blocks event loop, all requests stall
fs.readFileSync('file')
// ✅
await fs.promises.readFile('file')

// ❌ Load all records into memory → heap OOM on large datasets
await this.chatRepository.find()
// ✅
await this.chatRepository.find({ take: 50, skip: offset })

// ❌ EventEmitter listener leak → OOM over time (Socket.IO rooms)
socket.on('message', handler)  // without cleanup
// ✅
socket.on('message', handler)
socket.on('disconnect', () => socket.off('message', handler))

// ❌ DB connection pool exhaustion → all new requests hang
const conn = await dataSource.getConnection()  // never released
// ✅ Always use GqlTransactionInterceptor — interceptor handles release
```

### GROUP 2 — Data Integrity

Patterns that cause data loss or inconsistency — the most irreversible class of failure.

```typescript
// ❌ synchronize: true → TypeORM auto-alters schema → data loss in prod
TypeOrmModule.forRoot({ synchronize: true })
// ✅
TypeOrmModule.forRoot({ synchronize: false })
// Migrations only via: pnpm migration:generate / pnpm migration:run

// ❌ Multiple DB writes without transaction → partial update on failure
await this.roomRepository.save(room)
await this.chatRepository.save(message)  // if this fails, room is orphaned
// ✅ Use GqlTransactionInterceptor — interceptor handles commit/rollback

// ❌ N+1 query → DB overload under traffic
const rooms = await this.roomRepository.find()
for (const room of rooms) {
  room.chats = await this.chatRepository.find({ where: { room } })
}
// ✅
await this.roomRepository.find({ relations: ['chats'] })

// ❌ process.env.X directly → undefined propagates silently to DB
const secret = process.env.JWT_SECRET
// ✅ All env vars validated at startup via Joi; access via ConfigService only
const secret = this.configService.get<string>('JWT_SECRET')

// ❌ Pagination missing → full table scan, OOM, slow response
getMessages(): Promise<ChatEntity[]>
// ✅
getMessages(take: number, skip: number): Promise<ChatEntity[]>
```

### GROUP 3 — Security

Patterns where an external attacker is the threat — discovered latest, highest damage.

```typescript
// ❌ JWT secret hardcoded → full token forgery if source is exposed
sign(payload, 'mysecret')
// ✅
sign(payload, this.configService.get('JWT_SECRET'))

// ❌ bcrypt rounds < 10 → brute-force vulnerable
bcrypt.hash(password, 4)
// ✅
bcrypt.hash(password, 12)

// ❌ CORS origin: * → any domain can make authenticated requests
app.enableCors({ origin: '*' })
// ✅
app.enableCors({ origin: configService.get('ALLOWED_ORIGIN'), credentials: true })

// ❌ Raw @Body() without DTO → malicious payload reaches DB
async register(@Body() body: any)
// ✅
async register(@Body() dto: RegisterDto)  // class-validator enforced

// ❌ Role from client body → privilege escalation
const role = dto.role
// ✅ Role assigned server-side only, never from request payload

// ❌ Stack trace in error response → internal structure exposed
throw new Error(err.stack)
// ✅ GlobalExceptionFilter strips internal details in prod

// ❌ Sensitive data in logs → token/password in plaintext
this.logger.log(JSON.stringify(user))
// ✅
this.logger.log(`user signed in: ${user.id}`)

// ❌ File upload without validation → malicious file, storage exhaustion
@UploadedFile() file: Express.Multer.File
// ✅ Validate mimetype + size limit in multer config

// ❌ Redis keys without TTL → unbounded memory growth
await this.redis.set(key, value)
// ✅
await this.redis.set(key, value, 'EX', 86400)
```

## Engineering Principles

Reference for judgment calls, not a literal per-change checklist. Where a principle
restates an existing rule, the cited rule governs. Where it conflicts, follow
Principle Conflict Protocol.

### Philosophy
- KISS, YAGNI, Simplicity First — enforced procedurally by Scope Discipline
- Boy Scout Rule, Refactor Continuously — conflicts with Scope Discipline
  ("no unrelated refactors unless requested"); routed through Principle Conflict Protocol
- Principle of Least Astonishment — covered by "reuse existing patterns only"
- Convention over Configuration — favor the project's existing framework and
  validation conventions over introducing custom configuration
- Pragmatism over Perfection — conflicts with Never Do's zero-tolerance rules;
  routed through Principle Conflict Protocol — does not excuse a violation by default
- Unix Philosophy, Orthogonality — treated as restatements of SRP/SoC, not distinct rules
- Incremental Development — reflected in Introduction Analysis
- Continuous Improvement — reflected in Result Review; in-session only

### Design
- Separation of Concerns, Modularity, High Cohesion & Low Coupling — basis of
  the Architecture section's module boundaries
- Information Hiding, Encapsulation — reflected in centralized config/env access
  (see Architecture Decisions)
- Composition over Inheritance — prefer composition via dependency injection over
  building new class hierarchies; see SOLID > LSP below for a known counter-example
- Abstraction — conflicts with "no new abstractions unless asked"; routed through
  Principle Conflict Protocol
- Layered Architecture, Dependency Direction — reflected in the existing layering
  between request handling, business logic, and data access
- Feature Isolation — may conflict with an existing single-file-per-concern
  convention; routed through Principle Conflict Protocol
- Domain-Driven Design Mindset — not adopted. Current modules map to technical
  layers, not bounded domain contexts. Aspirational reference only — introducing
  domain layers/aggregates requires explicit request (architectural change under
  Scope Discipline)

### SOLID
- SRP — basis of the project's module/service boundaries
- OCP — extend via new classes/strategies, don't modify existing logic in place
  to add a new case
- DIP — favor constructor injection over direct instantiation
- LSP — watch for subclasses that strengthen a parent method's precondition
  (rejecting cases the parent would accept) — prefer composition over inheritance
  when adding a stricter variant of existing behavior. Routed through Principle
  Conflict Protocol when an existing pattern already does this
- ISP — no confirmed violation; do not introduce an interface layer until one is found

### Object Interaction
- Dependency Injection, Inversion of Control — already the framework's core
  mechanism; no new rule needed
- Command–Query Separation — reflected in the existing read/write API split,
  where one exists
- Favor Explicit Interfaces — already enforced via `any` ban / `unknown` narrowing
- Law of Demeter, Tell Don't Ask — judgment calls, no current violation identified

### Maintainability
- DRY, Fail Fast, Testability, Input Validation — covered by Testing conventions
  and Never Do Groups 1-3
- Idempotence — check whether retry/duplicate-submission behavior is documented
  for write operations; flag gaps rather than assuming idempotency
- Immutability — may conflict with an existing intentionally-mutable shared
  instance; routed through Principle Conflict Protocol — default is to leave as-is
- Self-Documenting Code, Readability over Cleverness, Keep Functions Small,
  Minimize Cognitive Load — judgment calls
- Refactor Continuously — see Boy Scout Rule above

### Reliability
- Input Validation, Fail Securely — covered by Never Do Group 3
- Defensive Programming — conflicts with boundary-only validation stance; routed
  through Principle Conflict Protocol — boundary-only wins by default
- Robustness Principle (Postel's Law) — conflicts with strict input validation and
  is a known security anti-pattern for parsing untrusted input; do not apply
- Graceful Degradation — reflected in existing client-side auth-refresh/retry
  handling, where one exists
- Error Transparency — conflicts with the existing practice of stripping internal
  error details from client-facing responses in production; transparency applies
  to internal logs only, never client responses
- Design by Contract, Deterministic Behavior — judgment calls, not adopted
- Safe Defaults — duplicate of Secure by Default below

### Performance & Security
- Secure by Default, Protect Sensitive Data, Fail Securely, Input Validation —
  covered by Never Do Group 3 and Logging conventions
- Principle of Least Privilege — already implemented via the existing numeric
  role/privilege-level comparison
- Avoid Premature Optimization / Measure Before Optimizing — same principle, treat as one
- Resource Efficiency — covered by pagination/N+1 examples
- Minimize Attack Surface — reflected in the existing API-surface boundary rules
  and upload validation, where applicable

### Collaboration & Quality
- Consistent Naming, Coding Standards — covered by the existing key-naming
  convention and Code Style section
- Automated Testing, Continuous Integration — covered by Testing and CI/CD sections
- Code Reviews — out of scope for this file; handled by code review tooling/process
- Version Control Discipline — out of scope; handled by the development tool's
  standard git safety practices
- Documentation as Code — reflected in auto-generated schema/API documentation
  and the Change Summary requirement, where applicable
- Reproducible Builds — check whether the lockfile and toolchain versions are
  pinned, and whether the base build environment is pinned by digest or only by
  tag. State only the guarantee that actually exists — do not imply stronger
  reproducibility
- Observability (Logging, Metrics, Tracing) — verify which of the three actually
  exist before claiming coverage. Do not claim metrics/tracing coverage if absent;
  adding either is a new dependency requiring explicit request

## Principle Conflict Protocol

When applying a principle from "Engineering Principles" would conflict with an existing
rule, established pattern, or current implementation — including when a violation is
discovered mid-task — stop work immediately. Do not continue past the conflict, and do
not silently resolve it by picking a side.

1. **Stop and explain**: state which principle is in tension with which existing rule or
   pattern (cite file:line), and why the conflict exists.
2. **State a prevention plan**: a concrete, scoped way to avoid this same conflict
   recurring (e.g., a new row in Clarification Protocol, a documented convention).
3. **Ask step-by-step, not as one flat question**: narrow down with the developer what
   is negotiable and what is not before proposing a resolution.
4. **Offer three resolution paths and let the developer choose** — do not default to one:
   - **Autonomous implementation** — proceed with the original plan, knowingly accepting
     the principle violation. State exactly what is being violated and why it is
     acceptable to leave as-is.
   - **Alternative implementation** — a scoped change that satisfies both the principle
     and the existing rule/pattern. State the concrete diff and its cost.
   - **Principle-faithful implementation** — fully honor the new principle, accepting
     the cost to the existing rule/pattern. State what changes and its cost.
   If two paths converge on the same concrete change, say so rather than presenting
   artificial alternatives.

Do not implement any path until the developer selects one.

## Project-Specific Principles

Concrete, project-grounded restatements of the generic principles above, plus
invariants discovered by tracing actual code paths. Overlap with "Engineering
Principles" is intentional — these are specific instantiations, not new rules. Where
one of these is violated, follow Principle Conflict Protocol.

### Module & Guard Architecture

**Guard Composition over Guard Inheritance**
- Breakdown: a concrete instance of SOLID > LSP. The REST guard chain composes
  (`@UseGuards(JwtAuthGuard, RBACguard)`, `user.controller.ts`); GraphQL admin-gated
  resolvers now follow the same pattern (`@RBAC(UserRole.admin)` +
  `@UseGuards(GraphQLAuthGuard, GraphQLRBACGuard)`, `chat.resolver.ts`). The previous
  `GraphQLAdminGuard extends GraphQLAuthGuard` subclass — which strengthened the
  parent's `canActivate` precondition, an LSP violation — has been removed.
- Rationale: the REST pattern already proved composition works for this exact
  requirement (auth + role check) without inheritance.
- Goal: any new role-gated guard is composed with existing guards, never built as a
  subclass that adds a stricter precondition.

**Transaction Boundary per Mutation**
- Breakdown: a concrete instance of the Data Integrity rules in Never Do Group 2,
  elevated to a design-time check rather than a code-review-time catch.
- Rationale: multi-table writes without a shared `QueryRunner` orphan partial state on
  failure; this is already enforced by `GqlTransactionInterceptor` for the `sendMessage`
  GraphQL mutation, but only as an implementation detail, not a stated design constraint.
- Goal: before implementing any handler with more than one repository write, the
  transaction boundary decision is made explicitly, not discovered after the fact.

**Interface/Type Placement by Cross-File Usage**
- Breakdown: a concrete instance of Separation of Concerns / Information Hiding. Applies
  equally to `interface` and object-shape `type` aliases — the syntax doesn't matter,
  only whether something outside the defining file depends on it. One
  consumed only within its defining file stays inline there (e.g. `CachedMessageEntry`
  in `redis.service.ts`, `GqlTransactionRequest` in `gql-transaction.interceptor.ts`,
  `JwtPayload` in `auth.service.ts`, `AuthenticatedRequest` in `user.controller.ts`,
  `GeminiContent` in `ai.service.ts`). One that is `export`ed and imported from a
  different *production* file is extracted to `{module}/interface/{name}.interface.ts`
  (`auth/interface/payload.interface.ts`, `redis/interface/cachable-message.interface.ts`).
  The folder keeps the `interface/` name regardless of whether the file inside holds an
  `interface` or a `type` alias.
- Exception: a type/interface whose only outside consumer is its own `*.spec.ts` (e.g.
  `AiReplyCallbacks` in `ai.service.ts`, imported solely by `ai.service.spec.ts` for mock
  typing) stays inline — a test importing its subject's exported type isn't the kind of
  cross-module dependency this folder exists to signal.
- Rationale: a module's `interface/` folder exists to signal "this is a contract other
  files depend on" — filling it with file-local types or test-only consumers dilutes that
  signal and makes the folder untrustworthy as a map of the module's public surface.
- Goal: before adding a new interface or type alias, check whether anything outside its
  defining file — excluding its own spec file — imports it. If not, keep it inline. If
  yes, place it under `{module}/interface/`.

### Auth & Session

**Single Refresh Authority**
- Breakdown: a concrete instance of DRY / Single Source of Truth, already documented
  in Frontend Conventions (`session-guard.ts`'s `refreshAccessTokenSafely()`).
- Rationale: concurrent callers sharing one in-flight refresh closes a real race where
  a second caller could adopt a conflicting account mid-redirect.
- Goal: no new call site ever calls the refresh endpoint directly; this prevents the
  race condition from resurfacing as the codebase grows.

**Single Active Session Enforcement**
- Breakdown: a concrete instance of a consistency invariant — at most one live socket
  per user. Enforced via `forceLogout` (`chat.service.ts:58-61`), which disconnects the
  previous socket when a new connection registers for the same user.
- Rationale: without this, a user with two open tabs/devices could receive duplicate or
  conflicting real-time state.
- Goal: any new per-user real-time registration (not just the existing socket path)
  must check for and evict a prior registration, not assume one connection per user.

### Privilege & Audit (Security)

**Role Population Invariants**
- Breakdown: two related checks in `user.service.ts` guard the role-distribution state
  itself, not just a single user's permissions: the last `superadmin` cannot be demoted
  (`:178-186`), and `admin` count is capped at `MAX_ADMIN_COUNT` (default 5, `:188-199`).
- Rationale: without these, a role-management bug could leave the system with zero
  superadmins (irrecoverable without DB access) or an unbounded admin population.
- Goal: any new role-mutation path (not just the existing one) must re-check these two
  population invariants — do not assume they only apply to the current update endpoint.

**Audit Trail for Privileged Actions**
- Breakdown: `AuditLogService.log(actorId, targetId, action, detail)` records every
  privileged user-management action — `ROLE_CHANGE`, `FORCE_LOGOUT`, `USER_DELETE`
  (`user.service.ts:208,239,321`) — as a separate, queryable entity.
- Rationale: privileged actions need an attributable record independent of the
  application logs (which rotate/are unstructured); this already exists but isn't
  named as a requirement anywhere in this file.
- Goal: any new privileged action (role change, force logout, deletion, ban, etc.)
  calls `AuditLogService.log()` — do not add a privileged mutation without an audit entry.

### Chat & Caching

**Render-Surface Sanitization**
- Breakdown: the backend validates message shape (`@IsString()`,
  `create-chat.dto.ts`) but does not sanitize or escape HTML — `ChatEntity.message` is
  stored exactly as submitted. The only sanitization point today is the React render
  boundary (`DOMPurify.sanitize`, `chat-page.tsx:705`).
- Rationale: this means stored content is untrusted by default; any other surface that
  later reads `ChatEntity.message` (an admin viewer, an export, a log line, an AI prompt
  context) inherits that risk if it assumes the value is already safe.
- Goal: any new consumer of `ChatEntity.message` sanitizes or escapes at its own
  boundary — never assume a prior layer already did it.

**AI Reply Channel Parity**
- Breakdown: AI-generated replies publish through the exact same channel and shape as
  human messages — `aiService.handleReply()` is given a `publishFn` that calls
  `pubSub.publish('receiveMessage :${roomId}', { receiveMessage: msg })`
  (`chat.resolver.ts:194-199`), identical to the human-message publish call (`:177`).
- Rationale: this is what lets the frontend render AI and human messages through one
  code path with no sender-type branching.
- Goal: any new automated/system message source (not just the AI service) publishes
  through this same channel and shape — do not introduce a second message-delivery path.

**Redis Adapter for Socket Horizontal Scaling**
- Breakdown: `ChatGateway.afterInit()` wires Socket.IO to a Redis-backed adapter
  (`@socket.io/redis-adapter`, `chat.gateway.ts:47-49`) so room membership and emits
  work correctly when more than one server instance is running.
- Rationale: without the adapter, `server.to(socketId).emit(...)` and room broadcasts
  only reach clients connected to the same process — silently broken under horizontal
  scaling.
- Goal: any new Socket.IO room/event assumes a multi-instance deployment; do not rely on
  in-memory socket state being visible across instances without the adapter.

**Distributed Lock for Concurrent Write Prevention**
- Breakdown: `AiService.handleReply()` acquires an atomic Redis lock
  (`SET ai:lock:{roomId} 1 EX 30 NX`, `ai.service.ts:109-116`) before generating a reply,
  and releases it in a `finally` block (`:178`); a failed acquisition skips the reply
  rather than queuing it.
- Rationale: without this, two messages arriving in quick succession for the same room
  could trigger two concurrent AI replies.
- Goal: any new per-room (or per-resource) background operation that must not run
  concurrently for the same key follows this same acquire-with-NX/TTL,
  release-in-finally pattern — do not introduce an unguarded concurrent write path.

## Architecture Decisions

Do not suggest alternatives to these decisions without explicit request.

### Auth
- accessToken: 15m lifetime, stored in-memory on frontend (Zustand store)
- refreshToken: 7d lifetime, stored in httpOnly cookie (set by backend on sign-in; `secure: true`, `sameSite: 'none'`)
- Guard order: `JwtAuthGuard` → `RbacGuard` → handler
- WebSocket auth: JWT validated on `handleConnection` via `client.handshake.headers.authorization` (Bearer token in Socket.IO handshake header)
- signOut: `POST /auth/signOut` — backend calls `res.clearCookie('refreshToken')` server-side; frontend clears Zustand store and redirects
- **Never suggest**: REST-only auth, session-based auth, storing accessToken in localStorage

### Cache (Redis via ioredis)
- Key naming: `{service}:{entity}:{id}` — e.g. `chat:session:userId`
- TTL required on every key — no indefinite cache
- pub/sub uses a dedicated subscriber connection, separate from the publisher connection, created inline in `graphql/pubsub.service.ts`
- **Never suggest**: node-redis (ioredis is unified across codebase)

### Database (PostgreSQL + TypeORM)
- `synchronize: false` always — migrations only
- Multi-write GraphQL mutations via `GqlTransactionInterceptor` + `@GqlQueryRunnerDecorator()` (currently `sendMessage` only)
- Service-level ACID (non-GraphQL, e.g. `updateRole`): `dataSource.transaction('SERIALIZABLE', callback)` — TypeORM manages begin/commit/rollback
- Relations: always explicit (`eager`/`lazy` never assumed from defaults)
- **Never suggest**: `synchronize: true`, manual QueryRunner lifecycle inline (`createQueryRunner → connect → startTransaction → commit/rollback → release`)

### API Layer
- GraphQL (Apollo) for all queries, mutations, subscriptions
- Socket.IO for real-time chat events only
- **Never suggest**: adding REST controllers where GraphQL infrastructure exists
- **Never suggest**: mixing Socket.IO and GraphQL Subscription for the same event

### CORS
- `CORS_ORIGIN` (`backend/src/app.module.ts:35`, `Joi.string().required()`) is a single
  env var holding a **comma-separated list** of allowed origins, split into an array in
  `backend/src/main.ts:42` before being passed to `app.enableCors({ origin })`
- Two known consumers must both be listed: the main `frontend/` (default `:5173`) and the
  separate `admin/` dashboard (default `:5174`, deployed to its own Vercel project) — see
  `backend/.env.example:36` for the local-dev example value
- `credentials: true` is required alongside this — both `frontend/` and `admin/` rely on
  the httpOnly refreshToken cookie (`withCredentials`/`credentials: 'include'`)
- **Never suggest**: `origin: '*'`, hardcoding origins in `main.ts` instead of the env var,
  or adding a new frontend/admin consumer without also adding its origin to `CORS_ORIGIN`

## Project Overview

Real-time one-to-one chat application. NestJS backend + React frontend in a **pnpm monorepo** (`backend/` and `frontend/` as workspace packages). Deployed on Railway (backend) and Vercel (frontend).

## Commands

### Root (workspace-level)
```bash
pnpm install          # Install all workspace dependencies
pnpm build            # Build backend (pnpm --filter backend build)
pnpm test             # Run backend tests
pnpm lint             # Lint backend
```

### Backend
```bash
cd backend
pnpm start:dev        # Development server with hot reload (port 3000)
pnpm build            # Compile TypeScript to dist/
pnpm lint             # ESLint with auto-fix
pnpm format           # Prettier formatting
pnpm test             # Unit tests (Jest)
pnpm test:cov         # Unit tests with coverage report
pnpm test:e2e         # End-to-end tests (test/ directory)
pnpm migration:generate -- src/migrations/MigrationName
pnpm migration:run    # Run pending migrations
```

### Frontend
```bash
cd frontend
pnpm dev              # Vite dev server (port 5173)
pnpm build            # Production build
pnpm lint             # ESLint
```

### Targeting a single test file
```bash
cd backend
pnpm test -- --testPathPattern=auth.service
```

### Docker (local full stack)
```bash
docker compose up -d --build
```

## Architecture

### Monorepo Layout
- **`backend/`** — NestJS backend (pnpm workspace package, single deployable)
- **`frontend/`** — React + Vite (pnpm workspace package)
- **`backend/src/`** — NestJS source
- **`backend/test/`** — E2E specs
- **`backend/src/migrations/`** — TypeORM migration files

### Backend Modules

**AppModule** wires together:
- `ConfigModule` — Joi-validated env (see `backend/.env.example` for all required vars)
- `TypeOrmModule` — PostgreSQL with `synchronize: false`; auto-runs migrations in prod
- `GraphQLModule` — Apollo Driver, auto-generates `backend/src/schema.gql`, subscriptions via `graphql-ws`
- `UserModule`, `ChatModule`, `AuthModule`, `AiModule`

**AuthModule** (`backend/src/auth/`)
- REST: `POST /auth/register`, `POST /auth/signin`, `POST /auth/signOut`, `POST /auth/token/refreshaccess`
- JWT access + refresh token pair; access token in memory, refreshToken in httpOnly cookie
- Guards: `JwtAuthGuard`, `RbacGuard`, `GraphqlAuthGuard`
- `UserRole` enum: `user` (0) | `admin` (1) | `superadmin` (2) — `RbacGuard` compares numeric privilege level (`rbac.guard.ts`); the last remaining `superadmin` cannot be demoted (`user.service.ts`)

**ChatModule** (`backend/src/chat/`)
- `ChatGateway` — Socket.IO: validates JWT on `handleConnection`, joins rooms (no chat-message handling)
- `ChatResolver` — GraphQL: `sendMessage` mutation, `receiveMessage` subscription (by roomId), `getOnlineUser` query
- `SessionCacheService` — tracks `userId → {socketId, status}` in Redis hashes with 24h TTL
- `RateLimitGuard` — Redis-backed 10 messages/15s per user
- `GqlTransactionInterceptor` wraps the `sendMessage` GraphQL mutation for ACID message saves (GraphQL-only — Socket.IO carries no chat-message traffic, so no REST/WS equivalent exists)

**UserModule** (`backend/src/user/`)
- REST: `GET /user`, `PATCH /user/:id`, `DELETE /user/:id`, `PATCH /user/:id/role` (admin-gated via `JwtAuthGuard` + `RBACguard`)
- `UserService` — CRUD, role management (`updateRole` uses SERIALIZABLE transaction + pessimistic lock), cascade room cleanup on delete
- Depends on `ChatModule`, `AuditLogModule`, `MailModule`

**AiModule** (`backend/src/ai/`)
- Provides `AiService` (Gemini reply generation) and `AiRoomService` (AI room configuration)
- `AiService.handleReply()` acquires `ai:lock:{roomId}` (NX/EX 30 s) before generating — prevents concurrent replies per room
- Triggered by `ChatResolver` after `ctx.req.transactionCommitted` resolves (post-commit hook, not inline)
- Registers `GENAI_CLIENT` (`@google/genai` `GoogleGenAI`) via `useFactory`

**RedisModule** (`backend/src/redis/`) — global module; provides `ioredis` client and `SessionCacheService`

**GraphQL PubSub** (`backend/src/graphql/pubsub.service.ts`) — `RedisPubSub` singleton bridging mutations to subscriptions

### Data Flow for Sending a Message
1. Client invokes the `sendMessage` GraphQL mutation (not Socket.IO — Socket.IO carries no
   chat-message traffic; see note below)
2. `RateLimitGuard` checks Redis counter
3. `GqlTransactionInterceptor` opens a `QueryRunner` before the resolver runs, and injects it
   via `@GqlQueryRunnerDecorator()`
4. `ChatService.sendMessage()` resolves or creates `RoomEntity`, saves `ChatEntity` in the transaction
5. Resolver publishes to the Redis Pub/Sub channel (`pubSub.publish`) and returns; subscribers
   receive exclusively via the `receiveMessage` GraphQL subscription
6. `GqlTransactionInterceptor` commits the transaction *after* the resolver returns — any logic
   that depends on the write being durable (e.g. the AI reply trigger) awaits
   `ctx.req.transactionCommitted` rather than assuming the commit already happened

Socket.IO (`ChatGateway`) is a separate channel with no overlap in message delivery: it
only handles connection auth (`handleConnection`/`handleDisconnect`), pushing a `CreateRoom`
event when a new room is created (`chat.service.ts`), and `forceLogout` on session conflict.
It has no `@SubscribeMessage` handler for chat messages and emits none.

### Entities (TypeORM)
- `UserEntity` — email (unique), hashed password, role, relations to chats/rooms
- `ChatEntity` — message text, participant (sender FK), room FK
- `RoomEntity` — many-to-many with users (join table), one-to-many with chats
- All extend `EntityBase` (created/updated timestamps, excluded from API responses)

### Frontend Architecture (`frontend/src/`)
- **`api/apollo.ts`** — Apollo Client config
- **`api/graphql-operations.ts`** — all GQL queries, mutations, subscriptions in one file
- **`socket/socket.ts`** — Socket.IO client singleton
- **`store/auth.store.ts`** — Zustand store: JWT in memory (refreshToken is httpOnly cookie, not in store)
- **`auth/session-guard.ts`** — single entry point for silent accessToken refresh; detects cross-tab account conflicts
- **`pages/`** — `chat-page.tsx`, `signin-page.tsx`, `register-page.tsx`
- **`components/protected-route.tsx`** — wraps authenticated routes

## Key Conventions

### Testing
- Tests live alongside source files as `*.spec.ts`
- Jest excludes controllers, gateways, guards, interceptors, resolvers, decorators, strategies, DTOs, entities from coverage — only services and the Redis module are measured
- Bcrypt mocked globally via `backend/src/mocks/bcrypt.ts`
- `mockReturnValue` (sync) vs `mockResolvedValue` (async) — must not be confused
- `QueryRunner` mock pattern: `as unknown as QueryRunner`
- DB direct access in tests is forbidden — use repository mocks

```typescript
// Standard repository mock pattern
const mockRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};
```

### Environment Variables
- Copy `backend/.env.example` to `backend/.env` for local dev
- All vars validated at startup via Joi; missing vars throw on boot
- `DB_TYPE` must be `"postgres"`
- Never access `process.env` directly — use `ConfigService`

### Transactions
- **GraphQL mutations** (`sendMessage`): use `@UseInterceptors(GqlTransactionInterceptor)` + `@GqlQueryRunnerDecorator()` — interceptor opens/commits/rolls back the `QueryRunner`; post-commit logic must await `ctx.req.transactionCommitted`
- **Service-level ACID** (non-GraphQL, e.g. `UserService.updateRole`): use `dataSource.transaction('SERIALIZABLE', async manager => { ... })` — TypeORM manages the full lifecycle
- **Never**: manual `createQueryRunner → connect → startTransaction → commit/rollback → release` inline in any method

### Logging
- Use injected NestJS `Logger` (winston under the hood)
- Logs write to `logs/logs.log` and `logs/error.logs.log` in non-Vercel environments
- Never log sensitive fields: `password`, `token`, `refreshToken`, `secret`

### Code Style
- Single quotes, trailing commas (`backend/.prettierrc`)
- `@typescript-eslint/no-explicit-any` is off in ESLint — but `any` is still forbidden by convention (see Never Do)
- Floating promises are warnings in ESLint — but must be awaited or caught by convention (see Never Do)

### Frontend Conventions

#### State (Zustand — `frontend/src/store/auth.store.ts`)
- `accessToken`, `userId` — in-memory only; intentionally excluded from `partialize`
- `lastRecipientId` — only persisted field via `persist` middleware
- Non-React contexts (apollo.ts, socket.ts): always read via `useAuthStore.getState()`, not hooks
- **Never**: add a second `persist` key for auth data; never access `localStorage` directly for tokens

#### Session Guard (`frontend/src/auth/session-guard.ts`)
- `refreshAccessTokenSafely()` is the **only** way to silently re-derive an accessToken from the shared `refreshToken` cookie — `protected-route.tsx`, `apollo.ts` (errorLink + wsLink), and `axios.ts` all call this one function instead of hitting `/auth/token/refreshaccess` directly
- Concurrent callers share one in-flight request (`pendingRefresh`) — this isn't just a thundering-herd optimization, it closes a real race where a second caller could land between a conflict's `clearSessionUser()` and the redirect, and silently adopt the conflicting account
- `sessionStorage['chat:sessionUserId']` is a tab-scoped marker (not shared across tabs, unlike the cookie) recording which account this tab last authenticated as — a refresh that resolves to a different account means a sibling tab logged in as someone else and overwrote the shared cookie; the tab is logged out instead of silently switching identity
- Conflict-triggered logouts redirect to `/?reason=conflict`, which `signin-page.tsx` reads to show a neutral "logged out elsewhere" notice — never a security-alarm-toned message, since this guard can't distinguish a benign second login from an actual compromise
- **Never**: call `/auth/token/refreshaccess` directly from a new call site, or call `setTokens()`/`clearTokens()` around a silent refresh without going through this module

#### Apollo Client (`frontend/src/api/apollo.ts`)
- `errorLink` owns all 401 recovery (refresh → retry) — do not add duplicate retry logic in components
- `authLink` calls `useAuthStore.getState()` at request time; this is intentional, not a stale-closure bug
- Split rule: subscriptions → `wsLink`; queries/mutations → `errorLink → authLink → httpLink`
- **Never**: instantiate a second `ApolloClient`

#### Socket.IO (`frontend/src/socket/socket.ts`)
- `socket` is a mutable module export; `reconnectSocket()` reassigns it after token refresh
- `autoConnect: false` is intentional — connect only after auth is confirmed
- **Never**: call `socket.connect()` before verifying `accessToken` is non-null

#### GQL Operations (`frontend/src/api/graphql-operations.ts`)
- All queries, mutations, subscriptions in one file — do not split by feature
- New operation: append to file, follow existing `gql` tag naming convention

#### Components
- Route auth: handled solely in `protected-route.tsx` — no auth checks inside page components
- No component-level API instances — all data via Apollo or the shared `socket` singleton

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`):
1. **Test job**: `pnpm install` → `pnpm --filter backend lint` → `pnpm --filter backend test` (Node 24, pnpm 10.14.0)
2. **Deploy job**: `pnpm --filter backend build` → Railway CLI deploy (requires `RAILWAY_TOKEN` secret)

Railway start command: `cd backend && pnpm migration:run && node dist/main`