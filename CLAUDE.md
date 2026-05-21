# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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