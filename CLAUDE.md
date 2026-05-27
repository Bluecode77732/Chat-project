# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hallucination Prevention (환각 방지)
Before making any change:
1. Inspect the codebase thoroughly — read the relevant files, grep for symbols, trace the actual call chain.
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
- New dependency additions
- Schema or migration changes
- Large-scale formatting edits

Stick strictly to the stated task.

## Introduction Analysis (도입)
When a new tool, library, or concept is being introduced, always cover the following before writing any code:
- Background: why it was created and what problem it solves
- Implementation purpose: what specific goal it serves in this context
- Practical disadvantages if not implemented, and the root causes of those disadvantages

Do not write excessive code during this phase.

## Structure Analysis (구조)
When planning an implementation, answer the following before proceeding:
- What overall structure will this create, end to end?
- Does the current structure and plan align with general web development principles?
- Provide a detailed breakdown: overall architecture, page flow, data flow, etc.
- What is the core relationship between this implementation and the existing project?
- If a relationship exists, what is the concrete, practical impact of that relationship?

## Modification Analysis (수정)
For each change being made, explicitly state:
- What does this change mean in plain terms?
- What is the purpose of implementing it?
- Why is it being implemented at this stage specifically?
- Does it fit the existing design structure — verify and list the reasons it does or does not.

## Result Review (결과 검토)
After completing any implementation, apply the review perspective that matches what was just done.

**After an Introduction:**
Review from a business/purpose perspective.
- Did this tool/library actually solve the problem it was introduced to solve?
- Is the implementation purpose clearly reflected in the result?
- Would skipping this still cause the practical disadvantages described earlier?

**After a Structure change:**
Review from an architecture consistency perspective.
- Does the implemented structure match the plan that was laid out?
- Is it consistent with existing patterns in the codebase?
- Does the data flow and page flow behave as designed?
- Did the implementation maintain alignment with general web development principles?

**After a Modification:**
Review from a technical and risk perspective.
- Do the changes work correctly? Run `pnpm lint` and `pnpm test` to verify.
- Are there any regressions in existing functionality?
- What side effects or hidden risks does this change introduce?
- Is the change isolated enough, or does it bleed into unrelated areas?

## Project Overview

Real-time one-to-one chat application. NestJS backend + React frontend in a **pnpm monorepo** (backend at root, frontend at `frontend/`). Deployed on Railway (backend) and Vercel (frontend).

## Commands

All backend commands run from the repo root; frontend commands run from `frontend/`.

### Backend
```bash
pnpm install          # Install all dependencies
pnpm start:dev        # Development server with hot reload (port 3000)
pnpm build            # Compile TypeScript to dist/
pnpm lint             # ESLint with auto-fix
pnpm format           # Prettier formatting
pnpm test             # Unit tests (Jest)
pnpm test:cov         # Unit tests with coverage report
pnpm test:e2e         # End-to-end tests (test/ directory)
pnpm migration:generate -- src/migrations/MigrationName  # Generate migration
pnpm migration:run    # Run pending migrations
```

### Frontend
```bash
cd frontend
pnpm install
pnpm dev              # Vite dev server (port 5173)
pnpm build            # Production build
pnpm lint             # ESLint
```

### Run a single test file
```bash
pnpm test -- --testPathPattern=auth.service
```

### Docker (local full stack)
```bash
docker compose up -d --build
```

## Architecture

### Monorepo Layout
- **Root (`src/`)** — NestJS backend (single deployable)
- **`frontend/`** — React + Vite (pnpm workspace)
- **`test/`** — E2E specs
- **`src/migrations/`** — TypeORM migration files
- **`migrations/`** — Compiled migration history

### Backend Modules

**AppModule** wires together:
- `ConfigModule` — Joi-validated env (see `.env.example` for all required vars)
- `TypeOrmModule` — PostgreSQL with `synchronize: false`; auto-runs migrations in prod
- `GraphQLModule` — Apollo Driver, auto-generates `src/schema.gql`, subscriptions via `graphql-ws`
- `UserModule`, `ChatModule`, `AuthModule`

**AuthModule** (`src/auth/`)
- REST: `POST /auth/register`, `POST /auth/signin`, `POST /auth/token/refreshaccess`
- JWT access + refresh token pair; access token stored in memory on frontend, refresh token in localStorage
- Guards: `JwtAuthGuard`, `LocalAuthGuard`, `RbacGuard`, `GraphqlAuthGuard`
- `UserRole` enum: `signedIn` | `signedOut`

**ChatModule** (`src/chat/`)
- `ChatGateway` — Socket.IO: validates JWT on `handleConnection`, joins existing rooms, handles `sendMessage` event
- `ChatResolver` — GraphQL: `sendMessage` mutation, `receiveMessage` subscription (by roomId), `getOnlineUser` query
- `SessionCacheService` (via RedisModule) — tracks `userId → {socketId, status}` in Redis hashes with 24h TTL
- `RateLimitGuard` — Redis-backed 10 messages/min per user
- Transaction interceptors wrap both REST and WebSocket handlers for ACID message saves

**RedisModule** (`src/redis/`) — global module; provides `ioredis` client and `SessionCacheService`

**GraphQL PubSub** (`src/graphql/pubsub.service.ts`) — `RedisPubSub` singleton bridging mutations to subscriptions

### Data Flow for Sending a Message
1. Client emits `sendMessage` via Socket.IO or GraphQL mutation
2. `RateLimitGuard` checks Redis counter
3. Transaction interceptor opens a `QueryRunner`
4. `ChatService.sendMessage()` resolves or creates `RoomEntity`, saves `ChatEntity` in the transaction
5. Publishes to Redis Pub/Sub channel; subscribers receive via `receiveMessage` subscription
6. Socket.IO also broadcasts to the room

### Entities (TypeORM)
- `UserEntity` — email (unique), hashed password, role, relations to chats/rooms
- `ChatEntity` — message text, participant (sender FK), room FK
- `RoomEntity` — many-to-many with users (join table), one-to-many with chats
- All extend `EntityBase` (created/updated timestamps, excluded from API responses)

### Frontend Architecture (`frontend/src/`)
- **`api/apollo.ts`** — Apollo Client config
- **`api/graphql-operations.ts`** — all GQL queries, mutations, subscriptions in one file
- **`socket/socket.ts`** — Socket.IO client singleton
- **`store/auth.store.ts`** — Zustand store: JWT in memory, refresh token in localStorage
- **`pages/`** — `chat-page.tsx`, `signin-page.tsx`, `register-page.tsx`
- **`components/protected-route.tsx`** — wraps authenticated routes

## Key Conventions

### Testing
Tests live alongside source files as `*.spec.ts`. The Jest config **excludes** controllers, gateways, guards, interceptors, resolvers, decorators, strategies, DTOs, and entities from coverage — only services and the Redis module are measured. Bcrypt is mocked globally via `src/mocks/bcrypt.ts`.

### Environment Variables
Copy `.env.example` to `.env` for local dev. The app validates all vars at startup via Joi; missing vars throw on boot. The `DB_TYPE` value must be `"postgres"`.

### Transactions
Use `QueryRunnerDecorator` (REST) or `WsQueryRunnerDecorator` (WebSocket) to inject a `QueryRunner` — do not create raw transactions inline. Interceptors handle commit/rollback.

### Logging
Use the injected NestJS `Logger` (winston under the hood). Logs write to `logs/logs.log` and `logs/error.logs.log` in non-Vercel environments.

### Code Style
Single quotes, trailing commas (`.prettierrc`). `@typescript-eslint/no-explicit-any` is off. Floating promises are warnings, not errors.

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`):
1. **Test job**: `pnpm install` → `pnpm lint` → `pnpm test` (Node 24, pnpm 10.14.0)
2. **Deploy job**: `pnpm build` → Railway CLI deploy (requires `RAILWAY_TOKEN` secret)

Railway start command: `pnpm migration:run && node dist/main`