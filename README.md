![NestJS](https://img.shields.io/badge/NestJS-E0234E)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101)
![Redis](https://img.shields.io/badge/Redis-DC382D)
![GraphQL](https://img.shields.io/badge/GraphQL-E10098)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6)
![Jest](https://img.shields.io/badge/Jest-C21325)
![Docker](https://img.shields.io/badge/Docker-2496ED)
![React](https://img.shields.io/badge/React-61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF)
![Vercel](https://img.shields.io/badge/Vercel-000000)
![Gemini](https://img.shields.io/badge/Gemini-8E75B2)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

> 한국어 버전: [README.ko.md](README.ko.md)

# Chatterley — Real-Time Chat Application
A one-to-one real-time chat with an AI companion, behavioral moderation, and a separate admin panel, built solo. It is a learning and portfolio project: the goal is to build the message delivery path, authentication, and abuse handling of a real-time chat by hand, with the weight on the backend.


## Overview
**Stack**: NestJS · TypeScript · GraphQL (Apollo) · Socket.IO · Redis · PostgreSQL (TypeORM) · React · Vite · Docker · Gemini

- Messages: sent with the `sendMessage` GraphQL mutation and received through the `receiveMessage` subscription. Writes are wrapped in a transaction by `GqlTransactionInterceptor` ([ADR 0003](ADR/0003-database-transaction-strategy.md), [ADR 0004](ADR/0004-graphql-socketio-api-layer-split.md)). Socket.IO only handles connection auth, room-creation notices, and forced logout on a second login
- Authentication: the JWT access token lives in memory only, the refresh token in an httpOnly cookie. Role-based access control (RBAC) and an audit log for privileged actions
- Moderation: duplicate, flood, and velocity strikes escalate warn → mute → timed ban → permanent ban, and an admin can reverse them
- AI chat: Google Gemini 2.5 Flash with four selectable personalities. Capped output tokens, truncated history, a retry ceiling, and a per-room Redis lock. The AI's name `Chattey` is an alias set in the system prompt (`backend/src/ai/constants/system-prompts.ts`), different from the service name Chatterley
- Admin panel: a separate React app for user/room management, moderation actions, and audit-log CSV export
- Tests: backend Jest 13 suites / 254 tests, frontend Vitest 21 tests, and admin Vitest 14 tests pass (local run on 2026-10-22, commit `d684b19`). Playwright e2e for frontend and admin runs in CI ([Test Coverage](#test-coverage))
- History: built solo over 730 commits since 2026-01 (as of `d684b19`). Full history in [CHANGELOG.md](CHANGELOG.md)
- Docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [ADR/](ADR/) · [ROADMAP.md](ROADMAP.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

The incidents, bugs, and design decisions met along the way are written up in [Technical Decisions and Troubleshooting](#technical-decisions-and-troubleshooting) as problem → cause → fix → verification.


## Screenshots
Captured on a local stack (backend, Postgres, Redis, Vite dev servers), light theme, 1440 px wide.
Hosting is currently stopped (see [Hosting Status](#hosting-status)), so none of this was checked on a
deployed environment. Accounts and messages are throwaway demo data created through the app's own API.
The app has no language switch, so both READMEs use the same images. The UI is Korean throughout. Captures that show times were taken with the browser time zone fixed to UTC, so message and log times are UTC. Click an image to open the full-size file.

[![Two browser windows side by side: a message typed in one window appears in the other without a reload](docs/images/demo-realtime-chat.gif)](docs/images/demo-realtime-chat.gif)<br>**Live delivery** — two demo accounts side by side; messages arrive without a reload through the `receiveMessage` GraphQL subscription. Message times are shown in UTC (the browser time zone was fixed for the recording).

[![One-to-one chat between two demo accounts](docs/images/02-chat.png)](docs/images/02-chat.png)<br>**One-to-one chat** — messages arrive through the `receiveMessage` GraphQL subscription

[![AI chat with a Gemini reply](docs/images/04-ai-chat.png)](docs/images/04-ai-chat.png)<br>**AI chat** — a live Gemini reply, delivered through the same channel as human messages

[![Admin user list with a banned user's detail panel](docs/images/07-admin-users-panel.png)](docs/images/07-admin-users-panel.png)<br>**Admin users** — detail panel of a banned account with its recent audit entries

| | |
|---|---|
| [![Sign-in screen with email and password fields](docs/images/01-signin.png)](docs/images/01-signin.png)<br>**Sign in** — access token is kept in memory, refresh token in an httpOnly cookie | [![AI personality selection dialog](docs/images/03-ai-personality.png)](docs/images/03-ai-personality.png)<br>**AI personality** — the first AI chat asks for one of four personalities before the first message |
| [![Account settings with profile and account deletion](docs/images/05-account.png)](docs/images/05-account.png)<br>**Account** — profile edit and account deletion (current password required) | [![Admin dashboard with totals and recent audit logs](docs/images/06-admin-dashboard.png)](docs/images/06-admin-dashboard.png)<br>**Admin dashboard** — totals and recent audit logs (separate admin app) |

Known limitation of these captures: the dialog backdrop on the AI personality screen renders as solid
black. The overlay uses `bg-opacity-40`, which Tailwind 4 no longer provides.


## Hosting Status
Hosting is stopped for cost reasons. The last successful automatic deploy was on 2026-05-27; see the [`deploy.yml` run history](https://github.com/Bluecode77732/Chat-project/actions/workflows/deploy.yml). The `deploy` job is manual-only (`workflow_dispatch`). To run the app, follow [Quick Start](#quick-start) locally.


## My Role and AI Usage
- **Form of work**: solo project.
- **How design decisions were made**: the first version used Socket.IO only. After learning that GraphQL can also carry two-way traffic, and wanting to try the technology, I had the AI explain the structure, reviewed the pieces it required, and decided on my own to move the message path to GraphQL ([Case 1](#technical-decisions-and-troubleshooting)). The other design decisions went as follows.
  - **Transaction interceptor**: introduced so that the DB write happens after the `QueryRunner` commit, so the repeated logic lives in one interceptor, and so the `QueryRunner`'s atomicity gives a safe transaction. I researched it myself and implemented it, and the AI filled in what I was missing
  - **Redis design**: built to serve as a cache so requests do not have to reach the DB, and as a standby-DB-like server that takes load off the server when many users connect. As with the interceptor, I researched it myself and implemented it, and the AI filled in what I was missing
  - **Moderation ladder**: after finishing each module I take a review break, and I came across this while discussing the next thing to build with the AI. I looked into whether it was a must-have, whether it fit the app, was sound, and was practical, reviewed ways to implement it, and chose the approach that kept the effect on other files as small as possible
- **Work handed to the AI (Claude Code)**: writing and editing code, code review and root-cause analysis, writing tests, writing docs
- **How the output was verified**: reading and editing the AI's code by hand, running it locally and in the browser, tests and CI, and a review in a separate AI session from the one that wrote the code
- **AI working rules**: [CLAUDE.md](CLAUDE.md) at the repository root holds the rules the AI follows (forbidden patterns, change scope, confirm-before-implementing steps)
- **AI suggestions I rejected or changed**: before [CLAUDE.md](CLAUDE.md) existed, the AI sometimes put decorators on entities that did not need them or used types such as `any`, `null`, and `!` carelessly, and I read the code and fixed them by hand. Those patterns are in CLAUDE.md's forbidden list today
- **Parts I can explain without the code**: the `sendMessage` flow, when the transaction commits, and the guard chain (see [Flow](#flow) and [ARCHITECTURE.md](ARCHITECTURE.md))


## Project Motivation
- Built solo, iterating live over 730 commits (2026-01-02 ~ present; the count is as of `d684b19`, see [CHANGELOG.md](CHANGELOG.md) for the history): Socket.IO connection handling, Redis session/cache/pub-sub, and the tradeoffs between raw WebSocket messaging and GraphQL Subscriptions for real-time delivery
- Migrated the message-delivery path from direct Socket.IO message passing to a GraphQL Mutation/Subscription split with transactional guarantees **while the app was already working**, to learn what that kind of change actually costs in a live system, not just on paper
- Practiced authentication/authorization end-to-end — Basic/Bearer/JWT, RBAC guards — including finding and fixing a self-discovered XSS/localStorage token-storage vulnerability
- Handled a live security incident (an exposed local dev port that led to a ransomware bot wiping the dev database) end-to-end: containment, credential rotation, cleanup — documented as a case study, not glossed over
- Kept KISS/YAGNI as a default, but didn't stop at a feature demo: added a behavioral moderation pipeline, a separate admin panel, and CI/CD (GitHub Actions + Railway/Vercel) the way a real service would need them


## Stacks
### Role and Code Location by Technology
| Area | Technology | Role in this project | Code location |
|---|---|---|---|
| Backend | NestJS, TypeScript | Single-deployable monolith split into auth/chat/user/ai/moderation/audit-log/mail/redis/health modules | `backend/src/` |
| API | GraphQL (Apollo), graphql-ws | Mutation to send a message, per-room subscription to receive it | `backend/src/chat/chat.resolver.ts`, `backend/src/graphql/` |
| Realtime | Socket.IO, `@socket.io/redis-adapter` | JWT auth on connect, room-creation notice, `forceLogout` on a second login | `backend/src/chat/chat.gateway.ts` |
| Database | PostgreSQL, TypeORM | Users, rooms, messages, audit log. Schema changes go through migrations only (`synchronize: false`) | `backend/src/migrations/`, `backend/src/data-source.ts` |
| Cache / Pub-Sub | Redis (ioredis) | Session and online state, per-room recent-message cache, rate limits, moderation state, AI lock, GraphQL Pub/Sub | `backend/src/redis/redis.service.ts`, `backend/src/graphql/pubsub.service.ts` |
| Auth | Passport JWT, bcrypt | Sign-in, token refresh, role-based guards | `backend/src/auth/` |
| AI | Gemini (`@google/genai`) | Per-room personality-driven AI replies | `backend/src/ai/` |
| Config validation | Joi | Validates env vars at boot; boot fails if a required value is missing | `backend/src/app.module.ts` |
| Frontend | React, Vite, Zustand, Apollo Client | Chat UI, in-memory token, silent token refresh | `frontend/src/` |
| Admin | React, Vite | User/room management, audit log | `admin/src/` |
| Tests | Jest, Vitest, Playwright | Service unit tests, component/store tests, e2e | `backend/src/**/*.spec.ts`, `frontend/e2e/`, `admin/e2e/` |
| Build / CI | Docker Compose, GitHub Actions | Local full stack; lint, test, e2e, and doc-integrity checks | `docker-compose.yml`, `backend/Dockerfile`, `.github/workflows/deploy.yml` |

### Backend
- **Language**: TypeScript 5.7.3 — static typing across backend/frontend/admin catches the class of `undefined`-property bugs this project hit repeatedly during its early raw-debugging phase (see commit history, Jan–Mar)
- **Runtime**: Node.js 24.x (pinned via `.nvmrc` / `engines`) — non-blocking I/O suits a connection-heavy chat workload
- **Framework**: NestJS 11.1.19 — DI-based module boundaries kept the feature surface (auth/chat/user/ai/moderation/audit-log, etc.) decoupled as it grew from a single resolver to about ten modules
- **Architecture**: Monolith, single deployable — module boundaries (see [Project Structure](#project-structure)) provide separation without paying for service-mesh complexity this scale doesn't need
- **Realtime split**: Socket.IO 4.8.3 for connection lifecycle only (auth on connect, room-creation notifications) + GraphQL 16.12.0 Mutation/Subscription for chat messages (see [Flow](#flow)) — not the original design; messages were migrated off raw Socket.IO mid-project to get transactional guarantees around persistence (`GqlTransactionInterceptor`)
- **Database**: PostgreSQL + TypeORM 0.3.29 — relational integrity for interdependent user/room/chat/audit-log data; migrations only (`synchronize: false`) so schema changes stay reviewable
- **Cache / Pub-Sub**: Redis via ioredis 5.9.3 — session/online-status, a per-room recent-message cache, and `@socket.io/redis-adapter` for horizontal scaling (without it, room broadcasts don't cross server instances)
- **AI**: Google Gemini 2.5 Flash via `@google/genai`, 4 selectable personalities — cost-capped by design (output token limit, conversation-history truncation, retry ceiling), not bolted on after the fact
- **Auth**: JWT (access token in memory, refresh token in an httpOnly cookie) + Passport strategies; RBAC guards are composed at both the REST and GraphQL layer, not subclassed
- **Testing**: Jest unit tests on the service layer (see [Test Coverage](#test-coverage)), Playwright e2e for both `frontend/` and `admin/`
- **API Docs**: Swagger for REST + GraphQL introspection via Altair — Altair and Postman are used together since neither alone can exercise both Mutation and Subscription

### Frontend
A minimal React + TypeScript client built to demonstrate end-to-end integration with the backend.

- Stack: React 19.2.5, TypeScript ~6.0.2, Vite 8.0.10, Tailwind CSS 4.2.4, Zustand 5.0.12, Apollo Client 4.1.9, Socket.IO Client 4.8.3 ✔
- Auth: access token in memory (Zustand), refresh token in a backend-set httpOnly cookie — never in localStorage ✔
- Real-time: Socket.IO for connection/room management, GraphQL Mutation/Subscription for messaging ✔
- Security: XSS prevention via DOMPurify, CORS-compliant requests, Route Guard for protected pages ✔
- Deployment: Vercel (auto-deploy on push) ✔


## Features
- Real-time bidirectional messaging
- Rate limiting - 10 messages per 15s/user
- Behavioral moderation - duplicate/flood & velocity strikes escalate warn → mute → timed ban → permanent ban, with admin unban
- Security hardening - Helmet security headers on the backend (CSP intentionally omitted there: it serves almost no HTML, so it would only protect Swagger), Content-Security-Policy on frontend/admin instead (Vercel `headers`, since that's where the actual rendering surface is), trust proxy for accurate client IPs behind Railway, IP-based rate limiting on signin/register (10 attempts/60s per IP, 429 on exceed)
- Persistent user sessions across server restarts
- Private chat rooms between users
- Transaction-safe message storage & delivery
- Horizontal scaling ready - Redis-backed session
- AI chat powered by Google Gemini 2.5 Flash (4 personalities: Friendly, Coding, English, Creative)
- Cursor-based message history with infinite scroll
- Profile customization - optional nickname (unique, ≤20 chars) and profile image (jpeg/png/webp, ≤2MB) set via account settings
- Chat UX polish - `/` keyboard shortcut to focus the message input, dismissible "empty chat" notice, click-and-hold banner auto-scroll, aria-live region for moderation notices
- Admin dashboard - separate app for user/room management, moderation actions, and audit-log CSV export (see [Admin Panel](#admin-panel))


### Core Features and Where They Live
| Feature | What the user does | API / code | Worth noting |
|---|---|---|---|
| Messaging | A sent message shows up on the other side without a reload | `sendMessage` mutation, `receiveMessage(roomId)` subscription (`chat.resolver.ts`) | `GqlTransactionInterceptor` commits after the resolver returns, and logic that depends on the commit awaits `ctx.req.transactionCommitted`. Redis Pub/Sub is at-most-once |
| Auth and session | Stays signed in across reloads. Signing in as another account in another tab logs this tab out | `POST /auth/signin`, `POST /auth/token/refreshaccess`, `frontend/src/auth/session-guard.ts` | Every refresh goes through `refreshAccessTokenSafely()` and concurrent calls share one request. One active socket per user |
| AI chat | Talks to the AI account and picks a personality per room | `setAiPersonality` mutation, `AiService.handleReply()` | Per-room Redis lock (`ai:lock:{roomId}`, 30 s TTL), `maxOutputTokens` 300, 10 messages of history |
| Moderation | Flooding gets a warning, then a mute, then a ban | `ModerationService`, `ModerationGuard`, `POST /user/:id/unban` | Thresholds are env-tunable. A ban is enforced over HTTP, GraphQL, sockets, and token refresh. Every action is audit-logged |
| Admin panel | Manage users and rooms, export the audit log as CSV | `admin/src/`, `GET /audit-log`, `GET /audit-log/export` | A separate app that only uses queries and mutations (no realtime client) |


## Architecture
### System Context Diagram
```mermaid
flowchart LR
    FE["frontend<br/>chat UI (local 5173)"] -- "GraphQL + Socket.IO" --> BE["backend<br/>NestJS"]
    AD["admin<br/>dashboard (local 5174)"] -- "GraphQL query/mutation" --> BE
    BE --> PG[("PostgreSQL")]
    BE --> RD[("Redis")]
    BE -- "AI replies" --> GM["Gemini API"]
    BE -. "optional: role-change mail" .-> SMTP["SMTP"]
    BE -. "optional: 5xx errors" .-> SE["Sentry"]
```
admin has no realtime client (`graphql-ws`, `socket.io-client`), so it never takes part in chat. SMTP and Sentry do nothing when their env vars are empty ([backend/.env.example](backend/.env.example)).
### Project Structure
A pnpm monorepo with three packages: `backend/`, `frontend/`, and `admin/`. Only the key paths for finding the core code are listed. See [ARCHITECTURE.md](ARCHITECTURE.md#monorepo-layout) for the full directory tree.

| Path | Role | Files to look at first |
|---|---|---|
| `backend/src/chat/` | Message send/receive, socket connection, transactions | `chat.resolver.ts`, `chat.gateway.ts`, `chat.service.ts`, `interceptor/gql-transaction.interceptor.ts` |
| `backend/src/graphql/`, `backend/src/redis/` | Pub/Sub, session, cache, rate limits | `pubsub.service.ts`, `redis.service.ts` |
| `backend/src/auth/` | JWT auth, role-based guards | `strategy/jwt.strategy.ts`, `guard/` |
| `backend/src/moderation/` | Strike accrual, mute and ban enforcement | `moderation.service.ts`, `moderation.guard.ts` |
| `backend/src/ai/` | Gemini replies, per-room personality | `ai.service.ts`, `constants/system-prompts.ts` |
| `backend/src/user/`, `backend/src/audit-log/` | User management, audit log of privileged actions | `user.service.ts`, `audit-log.service.ts` |
| `backend/src/migrations/` | TypeORM migrations (the only place schema changes go) | `data-source.ts` |
| `backend/src/app.module.ts`, `main.ts` | Module wiring, env validation, boot settings | |
| `frontend/src/` | Chat UI | `api/apollo.ts`, `auth/session-guard.ts`, `socket/socket.ts`, `store/auth.store.ts`, `pages/chat-page.tsx` |
| `admin/src/` | Admin dashboard | `pages/`, `auth/session-guard.ts` |
| `frontend/e2e/`, `admin/e2e/` | Playwright e2e | |
| `ADR/`, `scripts/` | Design decision records, doc-integrity check scripts | |

### Session Store (Redis)
- Redis: session and online state live in a `user:{id}` hash (`socketId`, `status`) and an `online_users` set. The TTL is `SESSION_TTL_SEC` (default 86400 s), and every server instance sees the same values
- Socket objects can't be serialized, so they are not put in Redis. Each process's Socket.IO server holds its connected sockets
- An in-memory `userId → Socket` Map (`clientConnection`) was used before and was replaced by a Redis session cache (`backend/src/redis/redis.service.ts`). The reasoning and structure are in case 5 of [Technical Decisions and Troubleshooting](#technical-decisions-and-troubleshooting)

### Redis Pub/Sub
- `RedisPubSub` singleton (`pubsub.service.ts`): bridges GraphQL mutations to active subscriptions. After commit the resolver publishes to a `receiveMessage :${roomId}` channel; all connected `receiveMessage` subscribers receive the message in real time.
- `PubSubService.publish()` also caches the published message via `SessionCacheService.cacheMessage()` as a side effect — this is the **only** place message caching happens, identically for human and AI messages. Callers (resolver, `AiService`) never call `cacheMessage()` directly.

### Entities (TypeORM)
```
UserEntity
  id          PK
  email       unique
  nickname    nullable, unique, max 20 chars — display name shown to other users
  profileImage nullable text (base64 data URI, jpeg/png/webp, max ~2MB)
  password    excluded from API responses
  isAI        boolean (true only for the seeded AI system account)
  role        enum: user (0) | admin (1) | superadmin (2)
  status      enum: active | banned (moderation state, see Moderation)
  bannedUntil nullable timestamp — null means permanent ban or not banned
  chats    =< ChatEntity   (OneToMany)
  rooms    >< RoomEntity   (ManyToMany, join table on RoomEntity side)

ChatEntity
  id          PK
  message     string
  participant >= UserEntity  (ManyToOne — sender)
  room        >= RoomEntity  (ManyToOne)

RoomEntity
  id            PK
  participants >< UserEntity   (ManyToMany owner, @JoinTable)
  chats        =< ChatEntity   (OneToMany)

AiRoomEntity — split out of RoomEntity for separation of concerns and cleaner ongoing
management (see ARCHITECTURE.md's Entities section for the full rationale)
  id          PK
  room        -- RoomEntity  (OneToOne, onDelete: CASCADE)
  personality string (active AI personality for this room)

EntityBase (inherited by all four)
  created     CreateDateColumn — excluded from API responses
  updated     UpdateDateColumn — excluded from API responses
```


## Flow
All chat messages are sent and delivered through the **GraphQL Mutation Path**. Socket.IO
(`ChatGateway`) only handles the WebSocket connection lifecycle — it has no
`@SubscribeMessage` handler for chat messages and emits none.

### Socket.IO Connection Lifecycle
1. Client connects WebSocket, `handleConnection` runs in `chat.gateway.ts`
  1.1. Authenticate JWT token via `AuthService.parseBearerToken()`
  1.2. `ChatService.registerClient()` records `userId` => `socketId` in Redis
  1.3. `ChatService.joinRooms()` joins the client to their existing rooms
  1.4. On a session conflict, the previous socket for that user receives `forceLogout` and is disconnected

2. Room creation notification
  2.1. When `ChatService` creates a new `RoomEntity` (first message between two users), it
       emits `CreateRoom` to the recipient's socket so their client can join the new room

3. Client disconnects
  3.1. `handleDisconnect` runs in `chat.gateway.ts`
  3.2. `ChatService.removeClient()` marks the user offline in Redis only if the current session is this socket (ignored if a newer session already replaced it)

### GraphQL Mutation Path (`sendMessage`)
```mermaid
sequenceDiagram
    participant C as Client
    participant G as Guard chain
    participant I as GqlTransactionInterceptor
    participant S as ChatService
    participant DB as PostgreSQL
    participant R as Redis Pub/Sub
    participant V as Subscriber
    C->>G: sendMessage mutation
    Note over G: GraphQLAuthGuard → ModerationGuard → RateLimitGuard
    G->>I: pass
    I->>DB: begin transaction (QueryRunner)
    I->>S: sendMessage()
    S->>DB: find or create room, save ChatEntity
    S->>R: publish to the receiveMessage channel (per room)
    R-->>V: deliver subscription payload
    S-->>I: resolver returns
    I->>DB: commit (after the return)
    I-->>C: response
```
1. Client calls `sendMessage` mutation
  1.1. `GraphQLAuthGuard` → `ModerationGuard` → `RateLimitGuard` run in that order (the order matters: `ModerationGuard` filters out muted/banned users before `RateLimitGuard` spends their rate-limit budget)
  1.2. `GqlTransactionInterceptor` opens a `QueryRunner` and starts a transaction before the
       resolver runs, injecting it via `@GqlQueryRunnerDecorator()`
  1.3. `ChatService.sendMessage()` validates sender/recipient, finds or creates room, saves
       `ChatEntity` within that transaction
  1.4. Resolver publishes to `receiveMessage :${roomId}` via `PubSubService.publish()` and returns

2. Post-return commit
  2.1. `GqlTransactionInterceptor` commits the transaction *after* the resolver returns
  2.2. Any logic that depends on the write being durable awaits `ctx.req.transactionCommitted`
       rather than assuming the commit already happened at return time

3. AI reply (if recipient is AI user)
  3.1. `setImmediate` schedules the AI reply trigger, which first awaits `ctx.req.transactionCommitted`
  3.2. `AiService.handleReply()` acquires a Redis lock, builds conversation history, calls the Gemini API
  3.3. AI reply saved to DB, then published to Pub/Sub through the same `receiveMessage :${roomId}`
       channel as human messages — `PubSubService.publish()` caches it as a side effect (see Redis
       Pub/Sub above); `AiService` does not cache directly

4. Subscriber receives message
  4.1. Redis Pub/Sub delivers to all active `receiveMessage(roomId)` subscribers
  4.2. GraphQL subscription resolves and pushes payload to client

### Auth Token Lifecycle
The two tokens live in deliberately different places: the short-lived `accessToken` in memory only
(Zustand, excluded from `persist`), the long-lived `refreshToken` in a backend-set httpOnly cookie
that JavaScript cannot read. See [ADR 0001](ADR/0001-jwt-auth-token-strategy.md) for the rationale.

1. Sign-in — `POST /auth/signin` (Basic auth)
  1.1. Backend returns `accessToken` in the response body and sets `refreshToken` as an httpOnly
       cookie (`secure`, `sameSite: 'none'` — frontend and backend are separate origins)
  1.2. Frontend calls `setTokens(accessToken, userId)`; no token is written to `localStorage`

2. Authenticated request
  2.1. `authLink` reads `useAuthStore.getState().accessToken` at request time and sets
       `Authorization: Bearer`

3. Silent refresh — on page reload (memory is empty) or on a 401 surfaced by `errorLink`
  3.1. Every call site goes through `refreshAccessTokenSafely()` (`session-guard.ts`); concurrent
       callers share one in-flight request
  3.2. `POST /auth/token/refreshaccess` is sent with `credentials: 'include'` — the browser attaches
       the cookie automatically, so JavaScript never reads the refresh token
  3.3. A fresh `accessToken` comes back in the body and goes into memory again
  3.4. If the refresh resolves to a different account than this tab last authenticated as
       (`sessionStorage['chat:sessionUserId']`), the tab is logged out instead of silently
       switching identity

4. Sign-out — `POST /auth/signOut`
  4.1. Backend blacklists the access token and calls `res.clearCookie('refreshToken')` — the cookie
       is cleared even if the token is already expired or invalid
  4.2. Frontend clears the Zustand store and redirects


## Technical Decisions and Troubleshooting
Each case reads problem → cause → fix → verification. **Verification** lists only what was confirmed through code, tests, or a run, and keeps design expectations apart from real measurements. No performance numbers are given because none were measured. Runs refer to the local Docker environment on 2026-10-22 (Windows 10, Docker 28.5.1, commit `d684b19`).

### Case 1: Moving the message path from Socket.IO to GraphQL
- **Problem**: At first a Socket.IO handler received, saved, and delivered messages. A socket handler had no way to wrap a write that touches several tables, such as creating a room and saving a message, in one transaction.
- **Cause**: A socket handler has no layer that owns the transaction lifecycle per request (open the `QueryRunner`, commit, roll back, `release()`). Managing it by hand at every call site risks a missed `release()` leaking connections out of the pool, as [ADR 0003](ADR/0003-database-transaction-strategy.md) records.
- **Fix**: Sending moved to the `sendMessage` mutation and receiving to the `receiveMessage` subscription, with `GqlTransactionInterceptor` owning the transaction lifecycle. Socket.IO kept only connection auth, room-creation notices, and `forceLogout`. Keeping both paths was rejected because the same event could be duplicated or arrive out of order ([ADR 0004](ADR/0004-graphql-socketio-api-layer-split.md)). The change was made on an app that already worked, and both paths coexisted for about 4.5 months until the old Socket.IO message handler was deleted on 2026-06-11 ([ROADMAP.md](ROADMAP.md)).
- **Verification**:
  - `gql-transaction.interceptor.spec.ts` covers the success path (no result is emitted before the commit finishes), the error path (rollback, one `release`, `InternalServerErrorException`), and the case where the commit itself fails
  - In a local Docker run, sign-up → `sendMessage` → delivery to another account's `receiveMessage` subscription → `getMessages` was confirmed at the API level
  - Limit: Redis Pub/Sub is at-most-once, so a message published while nobody is subscribed is not redelivered (a limit accepted in ADR 0004). Performance before and after the move was not measured

### Case 2: Dev DB and Redis ports exposed to the internet
- **Problem**: During development PostgreSQL (5432), Redis (6379), and the backend (3000) were reachable from the internet. An automated ransomware bot logged in to PostgreSQL with default credentials, wiped the dev database, and left a ransom note.
- **Cause**: The ports in `docker-compose.yml` were bound to `0.0.0.0`, and the Windows Firewall profile of the Ethernet adapter that held a public IP was set to "Private (trusted)", so a Docker Desktop rule allowed inbound traffic on every port.
- **Fix**: Close the access path first (port bindings to `127.0.0.1`, loopback-only host in development, and the firewall profile switched to Public by hand), then rotate the DB and Redis passwords and the JWT secrets, and only then clean up the attacker's database. Cleaning first would let the bot recreate it at once, so the order was contain → rotate → clean. The AI did not read the attacker's table; a person did (prompt-injection prevention). To keep it from happening again, Redis `requirepass` was turned on and boot is refused when `ENV=prod` has a `REDIS_URL` without a password. Details in [AI-Assisted Development Notes](#ai-assisted-development-notes) and [ADR 0013](ADR/0013-local-dev-network-binding.md).
- **Verification**:
  - The settings were confirmed in code: the `127.0.0.1` bindings and `requirepass` in `docker-compose.yml`, the loopback branch in `main.ts`, and the `REDIS_URL` password check in `app.module.ts`
  - In a local Docker run, `docker compose ps` showed 3000, 5432, and 6379 bound to `127.0.0.1` only
  - Limit: no port scan from an outside network was run, and the password/secret rotation rests on the record from the time

### Case 3: AI reply cache corruption (`Invalid time value`)
- **Problem**: While checking the AI retry/fallback feature by hand in a browser, restarting the backend made the socket reconnect and reload the room's messages from the cache, and `CombinedGraphQLErrors: Invalid time value` appeared.
- **Cause**: `AiService` cached its own reply directly, and the publish hook in `PubSubService` cached the same reply a second time. The second copy had lost its `@Exclude()`-decorated `created` field, so reading it back gave `new Date(undefined)` (NaN inside), and the GraphQL `DateTime` scalar's `toISOString()` threw. `git show --stat` on the earlier caching refactor showed that refactor never touched `ai.service.ts`, so the duplicate was a leftover and not a design choice.
- **Fix**: `AiService` now publishes the raw entity, as the human-message path does, and the duplicate direct caching call is gone. Caching happens in one place, `PubSubService.publish()`.
- **Verification**:
  - `redis.service.spec.ts` has a case that pins the behavior where a cache entry with no `created` field becomes an Invalid Date, and `pubsub.service.spec.ts` covers the cache-on-publish behavior
  - `backend/src/ai/` no longer contains a `cacheMessage` call (confirmed by search)
  - `pnpm test` passes 13 suites / 254 tests
  - Limit: the same browser scenario (restart the backend, then reload) was not replayed on purpose; the error did not show up again during later use of the app

### Case 4: A generated migration reverts ON DELETE CASCADE
- **Problem**: `pnpm migration:generate` re-emits the ManyToMany join-table FK `FK_501a0aef55632e3cf2894bda97f` (`room_entity_participants_user_entity`) as `ON DELETE NO ACTION`, which quietly reverts the `ON DELETE CASCADE` that user deletion uses to clear room membership. Once reverted, deleting a user fails on an FK violation ([CLAUDE.md](CLAUDE.md)).
- **Cause**: The ManyToMany relation declares no `onDelete`, so TypeORM sees the DB's CASCADE as different from the declaration and generates a change that reverts it.
- **Fix**: A step was set to strip that FK line from every generated migration. As a safety net for human slips there is a static guard, `migration-cascade-guard.spec.ts`, which scans the source of each migration's `up()` as text and requires the CASCADE to survive. It rides `pnpm test`, so it fires locally and in CI. It is not run in production, where migrations have already been applied by boot time.
- **Verification**:
  - `pnpm test` with that spec passes 13 suites / 254 tests
  - Limit: the FK's delete behavior (`confdeltype`) on a running DB was not queried in this run

### Case 5: From an in-memory socket map to a Redis session
- **Problem**: Keeping `userId → Socket` only in a Map in process memory loses it on a restart, and once there is more than one instance, the others can't tell where a user is connected or whether they are online.
- **Cause**: The Map is process-local state, and a Socket object can't be serialized, so it can't be shared as is.
- **Fix**: The old in-memory `clientConnection` Map was replaced by a Redis-backed session cache (comment in `redis.service.ts`).
  - A `user:{id}` hash (`socketId`, `status`) carries a TTL (`SESSION_TTL_SEC`, default 86400 s), and the online list is an `online_users` set. `hset`, `expire`, and `sadd` run in one MULTI/EXEC so no key without a TTL is left behind
  - At startup and every 5 minutes `online_users` is reconciled against `user:{id}` to drop ghost users. It does not delete unconditionally because that would also remove users connected to other instances
  - A new socket is recorded as the current session first, and only then does the previous socket get `forceLogout`. `removeClient` marks a user offline only when the current session is that socket ([ADR 0014](ADR/0014-single-active-session.md))
  - Room broadcasts cross instances through `@socket.io/redis-adapter`

  Current code (`backend/src/redis/redis.service.ts`) for going online:
  ```ts
  async sethUserOnline(userId: number, socketId: string) {
    const key = `user:${userId}`;
    const ttl = this.configService.get<number>('SESSION_TTL_SEC', 86400);
    await this.redis
      .multi()
      .hset(key, 'socketId', socketId, 'status', 'online')
      .expire(key, ttl)
      .sadd('online_users', String(userId))
      .exec();
  }
  ```
- **Verification**:
  - Confirmed in code: the structure above, the adapter wiring in `chat.gateway.ts`, and the unit tests in `redis.service.spec.ts` and `chat.service.spec.ts`
  - Design expectation (not verified): without the adapter, `server.to(room).emit(...)` reaches only clients connected to the same process
  - Measurement: nothing was run with two or more instances or under load (not measured). There is no number showing it got faster
  - Checking the stored values (standalone local container, no password): connect with `docker exec -it redis-chat redis-cli` and run `KEYS user:*`, `HGETALL user:<user ID>`, and `TTL user:<user ID>`. The Redis in docker compose has `requirepass` on and needs a password (use `redis-cli -a "$REDIS_PASSWORD"`, the same way the compose healthcheck does; this command was not run here)


## Quick Start
- Prerequisites
  - Node.js 24.x (`.nvmrc`), pnpm >= 10 (the pinned version is in [CONTRIBUTING.md](CONTRIBUTING.md#prerequisites))
  - Docker >= v28.xx — path A below needs no local PostgreSQL or Redis install
  - `GEMINI_API_KEY` is a required env var and boot fails without it ([`app.module.ts`](backend/src/app.module.ts)). A Gemini API key is needed to get real AI replies

### A. Run backend + PostgreSQL + Redis with Docker
**1. Install dependencies** (needed to run frontend and admin)
```bash
pnpm install
```

**2. Create `.env.docker` at the project root** (not tracked by git). Every value below is a placeholder; fill in your own.
```env
ENV=dev
DB_TYPE=postgres
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<any password>
DB_DATABASE=chatdb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<same value as DB_PASSWORD>
POSTGRES_DB=chatdb
REDIS_PASSWORD=<any password>
REDIS_URL=redis://:<REDIS_PASSWORD value>@redis:6379
HASH_ROUNDS=12
REFRESH_TOKEN_SECRET=<any long random string>
ACCESS_TOKEN_SECRET=<any long random string>
REFRESH_TOKEN_SECRET_EXPIRES_IN=604800
ACCESS_TOKEN_SECRET_EXPIRES_IN=900
USER_CACHE_TTL_SEC=300
SESSION_TTL_SEC=86400
MESSAGE_CACHE_TTL_SEC=86400
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
GEMINI_API_KEY=<your Gemini API key>
```
`NODE_ENV` and `RUNTIME_ENV` are set by compose, so leave them out ([docker-compose.yml](docker-compose.yml)). The `postgres` and `redis` containers read `POSTGRES_*` and `REDIS_PASSWORD` from the same file. Expiry values accept seconds as a number only (a string such as `7d` is rejected at boot). The full variable list is in [backend/.env.example](backend/.env.example).

**3. Start the services**
```bash
docker compose up -d --build
```
Migrations run automatically when the container starts, so don't run them by hand. To check boot, `http://localhost:3000/health` returns `{"status":"ok"}`.

**4. Run the frontend** (separate terminal)
```bash
cp frontend/.env.example frontend/.env.local
cd frontend && pnpm dev
```
→ http://localhost:5173

**5. Run the admin panel** (separate terminal; needs an admin/superadmin account)
```bash
cp admin/.env.example admin/.env.local
cd admin && pnpm dev
```
→ http://localhost:5174 — the first superadmin has to be created in the DB by hand (see [Admin Account Setup](#admin-account-setup)).

**Stopping**: `docker compose down` removes the containers and keeps the data (volumes). `docker compose down -v` also deletes the PostgreSQL and Redis volumes, so the data is lost.

### B. Manual run (with a local PostgreSQL 18 and Redis)
```bash
pnpm install
cp backend/.env.example backend/.env     # fill in the values. DB_TYPE is postgres; DB_HOST and REDIS_URL are local addresses
pnpm --filter backend build               # migration:run uses dist/data-source.js, so build first
pnpm migration:run
docker run -d -p 6379:6379 --name redis-chat redis:latest   # if it already exists: docker start redis-chat
cd backend && pnpm start:dev
```
Creating the database in PostgreSQL is not covered here. frontend and admin are the same as steps 4 and 5 of path A.

### Verification Status
Checked on 2026-10-22 on Windows 10, Docker 28.5.1 / Compose 2.40.0, Node 24.8.0, pnpm 10.33.0, commit `d684b19`, in an isolated temporary clone.

| Item | Status |
|---|---|
| Path A: containers start, migrations run automatically, `/health` | Confirmed |
| Sign-up, sign-in, `sendMessage`, `receiveMessage` subscription delivery, `getMessages` | Confirmed at the API level |
| Superadmin INSERT, then admin sign-in and `GET /user` | Confirmed |
| frontend and admin dev servers | Only the response (200) was checked. Sign-in and the chat screen in a browser were not |
| Path B | Confirmed up to `build` then `migration:run`. `start:dev` and the first migration on an empty DB were not |
| AI replies, Playwright e2e, moderation behavior | Not checked in this run |
| Unit tests | backend 13 suites / 254 tests, frontend 21 tests, admin 14 tests pass |

**Run the tests**
```bash
pnpm test                         # backend Jest
pnpm --filter frontend test       # frontend Vitest
pnpm --filter admin test          # admin Vitest
cd backend && pnpm test:cov       # backend coverage
```
e2e (Playwright) runs with `pnpm --filter frontend e2e` and `pnpm --filter admin e2e`, and runs in CI.

**Swagger UI** — with the backend running: http://localhost:3000/document

**Try the chat** — chat messages travel over GraphQL only (a Mutation to send, a Subscription to receive).
Socket.IO only handles the connection lifecycle and room-creation notices and carries no chat-message traffic.
For the Altair/Postman walkthrough, see **API Documentation → Key Endpoints → Chat** below.

### Troubleshooting
List of Troubleshooting when the program runs
- Redis connection
  - Log: "GraphQLModule dependencies initialized"
  - Log: "Redis Error: AggregateError [ECONNREFUSED]"
  - Log: "Error: connect ECONNREFUSED ::IPv6 address:port"
  
  - Solution 
    - ✅ Open terminal to run `docker start redis-chat`

- Message saving failure in DB

  - Solution 
    - ✅ Take a look at `backend/src/chat/interceptor/gql-transaction.interceptor.ts`, which owns the transaction elements: `commitTransaction()`, `rollbackTransaction()`, `release()`. The commit runs after the resolver returns, so check that any post-commit logic awaits `ctx.req.transactionCommitted`.

- `pnpm migration:run` fails with `Unable to open file ... dist/data-source.js`
  - Solution
    - ✅ Build first with `pnpm --filter backend build`. `migration:run` reads the build output (`dist/data-source.js`)


## API Documentation
### Swagger UI
***You must register first to try all features.***
Parameters and response schemas for each REST endpoint (`Auth`, `User`, `Audit Log`) are in Swagger UI (`http://localhost:3000/document`) once the backend is running locally. For chat (GraphQL), Altair cannot test Mutations and Postman cannot test Subscriptions, so use the two tools together to cover sending and receiving.

### Key Endpoints
**REST** — parameters and schemas are in Swagger, so this lists only the permissions and limits that Swagger does not show.

| Endpoint | Permission | Limits / behavior |
|---|---|---|
| `GET /health` | None | Liveness check. Returns `{ status: 'ok' }` without checking DB/Redis (a dependency outage should not force a container restart) |
| `POST /auth/register`, `POST /auth/signin` | None | 10 attempts per 60 s per IP (429 on exceed). Credentials go in a Basic auth header |
| `POST /auth/signOut` | Signed in | Blacklists the current access token and clears the refreshToken cookie (the cookie is cleared even if the token is already expired/invalid) |
| `POST /auth/token/refreshaccess` | Refresh cookie | Refreshes the access token |
| `GET /user` | admin | `humanOnly` excludes the seeded AI and moderation-system accounts |
| `GET /user/:id`, `PATCH /user/:id` | Own account or admin | Nickname ≤20 chars and must be unique (400 if taken). Profile image is a base64 data URI, jpeg/png/webp, ≤2MB |
| `DELETE /user/:id` | Own account or admin | The seeded AI and moderation-system accounts cannot be deleted |
| `PATCH /user/:id/role` | superadmin | Accounts are created only through `POST /auth/register` |
| `POST /user/:id/force-logout`, `/ban`, `/unban` | admin | `ban` is permanent when `durationSec` is omitted and also evicts any active session. `unban` clears ban, mute, and strikes |
| `GET /audit-log` | admin | `userId` matches as actor or target |
| `GET /audit-log/export` | admin | Exports the same filtered results as CSV, capped at 10,000 rows (low-volume privileged-action data, so a flat cap is simpler than cursor streaming) |
**Chat**
- Socket.IO (connection lifecycle and room-creation events only — no chat-message traffic)
  ***Tap 1 & 2***
  - URL: `ws://localhost:3000`
  - Description: Open two Socket.IO taps on 'Postman'. Socket.IO handles connection auth and notifies clients when a new room is created. Chat messages are sent and received via the GraphQL Mutation/Subscription paths below.
  - Request Handlers
    - Default Request Handler: Socket.IO
    - Headers
      - key : authorization; value: Bearer token
    - Events: `CreateRoom` (Listen: ON) — emitted by the server when a new room is created between two users


- Altair (Subscription)
  - URL: POST `http://localhost:3000/graphql`
  - Description: This platform can be altered. Open a tap of in Altair, and set the request handlers as following, then connect to the GraphQL, if succeed you are able to test messaging communication when send messages from GraphQL as receiver.

  - Request Handlers
    - Default Request Handler: HTTP
    - Parameters (in JSON): {}
    - Subscription URL: http://localhost:3000/graphql
    - Use default request handler for subscription: off
    - Subscription type: WebSocket (graphql-ws)
    - Connection Parameters (in JSON): { "authorization": "Bearer token" }
  - Query
    ```altair
    subscription {
      receiveMessage(roomId: "19") {   
        id
        message
        participant {
          id
        }
      }
    }
    ```
  - Variable
    ```altair
    {}
    ```


- GraphQL (Mutation)
  - URL: `http://localhost:3000/graphql`
  - Description: Any tool that can call GraphQL over HTTP works here. In Postman, open a GraphQL tab and set the headers as follows; once set, you can test messaging communication as the sender.

  - Request Handlers
    - Headers: authorization: Bearer token
  - Query
    ```graphql
    mutation SendMessage($input: CreateChatInput!, $recipientId: Int!) {
        sendMessage(input: $input, recipientId: $recipientId) {
            id
            message
            participant {
              id
            }
            roomId
            createdAt
        }
    }
    ```
  - Variable
    ```graphql
    {
      "input": {
        "message": "Sent from Postman"
      },
      "recipientId": 2
    }
    ```


- GraphQL (Queries & Additional Mutations)
  - URL: `http://localhost:3000/graphql`
  - Headers: `authorization: Bearer token`

  **Queries**
  - `ping` => `String` — Unauthenticated health-check query, returns `"ping has returned."`
  - `getMessages(roomId: Int!, cursor?: Int)` => `[MessageType]` — Fetch up to 15 messages before the cursor (cursor-based pagination)
  - `getMyRooms` => `[RoomInfoType]` — List all rooms the authenticated user belongs to
  - `getRoom(recipientId: Int!)` => `Int` — Return the room ID shared with a recipient, or null if none
  - `getOnlineUser` => `[Int]` — List user IDs currently marked online in Redis
  - `getAllUsers` => `[Int]` — List all user IDs except the caller
  - `getUserNicknames` => `[UserType]` — List all non-AI users' `{id, nickname, profileImage}`, used to resolve display names/avatars (chat) or display names (Admin Panel — nickname only, profileImage not fetched there)
  - `getAiUserId` => `Int` — Return the system AI user's ID
  - `getSystemUserId` => `Int` — Return the moderation system account's ID (used as the actor on automated audit-log entries, e.g. `USER_MUTED`/`USER_BANNED`)
  - `getAiPersonalityInfo(roomId: Int!)` => `AiPersonalityInfoType` — Return the active personality for the room
  - `getAllRooms(page?: Int, take?: Int, sort?: String, sortBy?: String, search?: String)` => `PaginatedAdminRooms` — **(admin only)** Paginated/sortable/searchable room list, backs the Admin Panel's Rooms page

  **Mutations**
  - `setAiPersonality(roomId: Int!, personality: AiPersonality!)` => `Boolean` — Set or change the AI personality for a room
  - `deleteRoom(roomId: Int!)` => `Boolean` — **(admin only)** Delete a room

  `getAllRooms`/`deleteRoom` are gated by `@RBAC(UserRole.admin)` + `@UseGuards(GraphQLAuthGuard, GraphQLRBACGuard)` — the GraphQL-side mirror of the REST admin guard chain (see [Role](#role)).

  **Example — `getMessages` (cursor-based)**
  ```graphql
  query {
    getMessages(roomId: 19, cursor: 50) {
      id
      message
      participant { id }
      createdAt
    }
  }
  ```

  **Example — `setAiPersonality`**
  ```graphql
  mutation {
    setAiPersonality(roomId: 19, personality: CODING)
  }
  ```


## Build
### Total Installation
Dependencies (44)
- @apollo/server
- @as-integrations/express5
- @google/genai
- @nestjs/apollo
- @nestjs/common
- @nestjs/config
- @nestjs/core
- @nestjs/graphql
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/passport
- @nestjs/platform-express
- @nestjs/platform-socket.io
- @nestjs/swagger
- @nestjs/typeorm
- @nestjs/websockets
- @sentry/nestjs
- @socket.io/redis-adapter
- @types/bcrypt
- @types/passport-jwt
- bcrypt
- class-transformer
- class-validator
- cookie-parser
- dotenv
- graphql
- graphql-redis-subscriptions
- graphql-subscriptions
- helmet
- ioredis
- joi
- jwt-decode
- nest-winston
- nodemailer
- passport
- passport-jwt
- pg
- reflect-metadata
- rxjs
- socket.io
- socket.io-client
- tsconfig-paths
- typeorm
- winston

DevDependencies (26)
- @eslint/eslintrc
- @eslint/js
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- @types/cookie-parser
- @types/express
- @types/jest
- @types/node
- @types/nodemailer
- @types/supertest
- @types/winston
- cross-env
- eslint
- eslint-config-prettier
- eslint-plugin-prettier
- globals
- jest
- prettier
- source-map-support
- supertest
- ts-jest (custom jest config)
- ts-loader
- ts-node
- typescript
- typescript-eslint


### Configuration
Once installation is finished, go to `backend/src/app.module.ts`, and set up configuration of the package.

Package
- joi
  - This package is a built-in validator that enforce validation to an object schema and JavaScript objects.
  - To validate configuration files when they aren't automatically validated with `validationSchema` alone.

Methods
- join
  - Using from 'node:path' not 'path': to avoid conflict between external packages with same name.
  - It ensures OS cross-platform compatibility by using path separators.

```ts
  import * as Joi from 'joi';

  @Module({
    imports: [
      // FYI : A static method `forRoot`
      ConfigModule.forRoot({
      validationSchema: Joi.object({
        ENV: Joi.string().valid('dev', 'prod').required(),
        DB_TYPE: Joi.string().valid('postgres').required(),
        // ...remaining fields validate DB/token/Redis/CORS/Gemini/mail/moderation config —
        // see Environment Configuration below for the full current variable list
      }),
      isGlobal: true,
    }),
```


### Environment Configuration
Create a `backend/.env` file and paste variables below :
```env.example
  # Development Environment
  ENV=dev

  # DB configuration
  DB_TYPE=postgres
  DB_HOST=yourDatabase
  DB_PORT=yourPort
  DB_USERNAME=yourDBport
  DB_PASSWORD=yourDBpassword
  DB_DATABASE=yourDBtype

  # Hash 
  HASH_ROUNDS=hashRounds

  # Secret Token
  REFRESH_TOKEN_SECRET=yourEncodedSecretKey
  ACCESS_TOKEN_SECRET=yourEncodedSecretKey

  # Expiry — seconds as a number only (e.g. 604800 = 7d, 900 = 15m); "7d"/"15m" fails boot validation
  REFRESH_TOKEN_SECRET_EXPIRES_IN=expiryTime
  ACCESS_TOKEN_SECRET_EXPIRES_IN=expiryTime

  # Redis Configuration
  REDIS_URL=redis://user:password@host:port

  # Redis TTL (seconds)
  USER_CACHE_TTL_SEC=300
  SESSION_TTL_SEC=86400
  MESSAGE_CACHE_TTL_SEC=86400

  # CORS allowed origins — comma-separated list (frontend, admin)
  CORS_ORIGIN=http://localhost:5173,http://localhost:5174

  # Google Gemini AI
  GEMINI_API_KEY=your-gemini-key
```

This is the minimal set needed to boot the server locally. The complete list — including the
optional `MAIL_*` variable group (SMTP notification config, used by the role-change email in
[Role](#role)) and `MODERATION_*` group (strike/ban tuning, all have defaults, see
[Moderation](#moderation)) — lives in [backend/.env.example](backend/.env.example).


### Chat
`ChatGateway` (`backend/src/chat/chat.gateway.ts`) only handles connection lifecycle — no `@SubscribeMessage` for chat messages, and it emits none. Chat messages go through GraphQL Mutation/Subscription instead (see [Flow](#flow)); this split exists because the app originally sent messages directly over Socket.IO and was migrated to GraphQL mid-project so message persistence could get transactional guarantees (`GqlTransactionInterceptor`) that a bare socket handler can't give you.

**`handleConnection`** — on every new socket:
1. Parses the JWT from the handshake `authorization` header (`authService.parseBearerToken`)
2. Rejects the connection if the token is missing/invalid, **or** if `moderationService.isUserBanned()` is true — this is the same ban gate `jwt.strategy` applies to HTTP/GraphQL, so a still-valid token can't bypass a ban by connecting over a socket instead
3. On success, stores the decoded payload on `client.data.user`, registers the socket (`chatService.registerClient`), and joins the user's existing rooms

**`handleDisconnect`** — reads `client.data.user` set in step 3 above and calls `chatService.removeClient()`; if connection was rejected before that point, there's nothing to clean up, so the two handlers stay symmetric.

**Horizontal scaling**: `afterInit` wires the Socket.IO server to `@socket.io/redis-adapter` (a pub/sub pair of Redis clients) — without it, `server.to(room).emit(...)` only reaches clients connected to the *same* process, which silently breaks the moment there's more than one backend instance.


### Docker 
#### Public - Dockerfile
Using Multi-Stage Pattern to reduce heavy-weight `devDependencies` of image and weakness of securities.
See [Deployment → Public - Railway](#public---railway) for the CI/CD flow that builds and deploys this image.

#### Local - docker-compose
Running all of services through Docker

- Requires `.env.docker` at the project root — see path A in [Quick Start](#quick-start) for the required variables (`NODE_ENV` and `RUNTIME_ENV` are set by compose)

- Start all of services
`docker compose up -d --build`

- Abort all of services (data is kept)
`docker compose down`

- Also delete the volumes — PostgreSQL and Redis data is lost
`docker compose down -v`

- DB migrations run automatically when the `chat` container starts (the `command` in `docker-compose.yml`)

- Check logs
`docker compose logs -f chat`

- Show 'chat' container
`docker ps`

- Verify Connection
`docker compose exec redis redis-cli ping`


#### Usage
See **Deployment → Local - Docker → Redis Container Usage** below for the redis-chat container start/stop/remove commands.


### Auth
- **Basic Auth** (`POST /auth/register`, `POST /auth/signin`) — email:password sent as a base64-encoded
  `Authorization: Basic` header, parsed and verified directly in `AuthService` (no Passport strategy involved)
- **JWT** (all other protected routes) — validated via `passport-jwt`'s `JwtAuthGuard`
  (`backend/src/auth/strategy/jwt.strategy.ts`); access token in the `Authorization: Bearer` header
- Both `register`/`signin` are rate-limited by `AuthRateLimitGuard` (see [Key Endpoints](#key-endpoints))


### User
`UserController`/`UserService` — REST CRUD over `UserEntity`. See [Key Endpoints](#key-endpoints) for
the full endpoint list, [Entities](#entities-typeorm) for the schema, and [Role](#role)/
[Moderation](#moderation) for role and moderation-status behavior.


### Role
- Three roles: `user` (0, default), `admin` (1), and `superadmin` (2).
- All registered users receive `user` role and can send messages normally.
- `admin` role grants elevated access: view/update/delete any user account, force logout, view audit logs.
- `superadmin` role additionally controls role assignment. Only superadmin can promote or demote other users.
- First superadmin must be created via direct DB INSERT. Subsequent admins can be promoted via the admin panel.
- Every role change sends the target user an email via `MailService` (non-blocking — a delivery failure is logged but does not fail the role change).
- `MAX_ADMIN_COUNT` env var (default: 5) limits the number of `admin`-role accounts. Superadmin accounts are not counted toward this limit.

**Server-side invariants** (enforced regardless of caller, not just a UI restriction):
- The last remaining `superadmin` cannot be demoted — `updateRole` blocks it so the system can never end up with zero superadmins
- `admin`-role accounts are capped at `MAX_ADMIN_COUNT`
- The seeded AI reply account and moderation system account can never be deleted — `UserService.remove()` rejects it, since either would silently break AI replies or moderation notices
- Unlike force-logout/ban/unban/delete, `updateRole` does **not** reject a target with an equal or higher role — a superadmin can demote another superadmin. This is intentional: see [Compromised Superadmin Containment](#compromised-superadmin-containment) below.


### Compromised Superadmin Containment
Policy: always keep at least two `superadmin` accounts. With only one, a compromised
superadmin can't be demoted by anyone — the last-superadmin invariant above blocks it, and
there's no peer left to act. With two or more, containment is a normal in-app action, not a
DB-access situation:

1. Sign in to the admin panel as the *other* superadmin.
2. Users → find the compromised account → **Demote (superadmin)**. This drops it to `admin`
   immediately (the target's next request re-resolves its role from the DB/cache, not from
   its still-valid access token — see [Role](#role) above), not after the access token expires.
3. Once demoted, the usual admin actions apply: **Force logout**, **Ban**, or **Delete**.
4. Promote a trusted account back to superadmin to restore the two-account minimum.
5. Review the audit log (`ROLE_CHANGE` / `FORCE_LOGOUT` / `USER_BANNED` entries for that user
   ID) for what the account did while compromised.

If only one superadmin exists and it's the one compromised, there is no in-app path — rotate
`ACCESS_TOKEN_SECRET`/`REFRESH_TOKEN_SECRET` (forces every session, including the attacker's,
to re-authenticate) and fix the row directly in the database. This is exactly the scenario the
two-account policy exists to avoid.


### Moderation
Behavioral abuse detection that escalates automatically and is reversible by an admin. It runs on the `sendMessage` path plus the auth/socket layer — there is no separate reporting UI. Detection, accrual, and enforcement live in `ModerationService`; a thin `ModerationGuard` gates muted/banned users out of `sendMessage`.

- **Strike sources**
  - *Duplicate / flood* — the same message (normalized) sent 3× within 60s adds a strike.
  - *Velocity* — tripping the `RateLimitGuard` (10 msgs / 15s) adds a strike (weighted the same).
- **Escalation ladder** — strikes accrue in a rolling 24h window (all thresholds env-tunable):
  - **3 strikes → warning** — a System-account message is posted into the room (rendered as a centered notice).
  - **5 strikes → temporary mute** — 10 min, Redis-backed; the user stays connected but cannot send.
  - **7 strikes → timed ban** — 7 days; a repeat ban (a second `USER_BANNED`) becomes **permanent**.
- **Enforcement** — a banned user is rejected at `jwt.strategy` (HTTP/GraphQL), at `handleConnection` (socket), and at token refresh, so a still-valid session cannot bypass the ban. A mute only blocks sending.
- **Recovery & audit** — `POST /user/:id/unban` (admin) clears ban/mute/strikes and invalidates the auth cache. Every action writes an audit entry (`USER_MUTED` / `USER_BANNED` / `USER_UNBAN`).
- **Storage** — `user_entity.status` (`active` | `banned`) and `bannedUntil` back persistent bans; strikes and mutes are Redis-only (`moderation:*` keys, all with TTL). Run the `AddModerationColumns` migration before starting.

Tunable env vars (optional; sensible defaults apply): `MODERATION_STRIKE_WINDOW_SEC`, `MODERATION_WARN_THRESHOLD`, `MODERATION_MUTE_THRESHOLD`, `MODERATION_MUTE_DURATION_SEC`, `MODERATION_BAN_THRESHOLD`, `MODERATION_BAN_DURATION_SEC`, `MODERATION_DUP_WINDOW_SEC`, `MODERATION_DUP_THRESHOLD`.

> The default values quoted throughout this section are mirrored in four places (here, CLAUDE.md, `backend/.env.example`, and the code). `MODERATION_DEFAULTS` in `backend/src/moderation/constants/moderation.constants.ts` is the single source of truth — change it there first, then re-sync the other three.

**Audit log action values** — every privileged action writes one of these to the audit trail (filterable via `GET /audit-log?action=`, see [Key Endpoints](#key-endpoints)):

| Action | Written by |
|---|---|
| `ROLE_CHANGE` | `PATCH /user/:id/role` |
| `FORCE_LOGOUT` | `POST /user/:id/force-logout`, or automatically on a manual/timed ban |
| `USER_DELETE` | `DELETE /user/:id` |
| `USER_BANNED` | Automatic ban-threshold escalation, or `POST /user/:id/ban` |
| `USER_MUTED` | Automatic mute-threshold escalation |
| `USER_UNBAN` | `POST /user/:id/unban` |


#### Manual E2E Verification (developer handoff)

Not covered by automated E2E (only unit tests). Verify with three accounts — **A** (offender),
**B** (recipient), and an **admin**. To reach the higher tiers quickly, temporarily lower the
thresholds in `.env` — keep them distinct (`warn < mute < ban`) or `escalate()`'s exact-match
checks collide, e.g. `MODERATION_WARN_THRESHOLD=2`, `MODERATION_MUTE_THRESHOLD=3`,
`MODERATION_BAN_THRESHOLD=4`, `MODERATION_MUTE_DURATION_SEC=30` — then restart the backend and
reset afterward.

1. **Warning** — from A, send B the *same* message repeatedly (within `DUP_WINDOW`, under the
   rate limit). At the warn threshold a centered System-account notice appears in the room;
   refresh the page → it persists (it is a stored `ChatEntity`).
2. **Mute** — keep sending. At the mute threshold A's next send is rejected (`ModerationGuard`
   → FORBIDDEN, frontend shows the mute notice); A stays connected and still *receives* B's
   messages. Note: while muted, `sendMessage` is blocked at the guard, so **no further strikes
   accrue** until the mute expires.
3. **Timed ban (auto)** — after the mute expires, resume flooding to cross the ban threshold.
   Expect: A is disconnected immediately; a reconnect is refused at `handleConnection`; a token
   refresh is refused — a still-valid access token cannot bypass it. After `bannedUntil`
   elapses, A can use the app again.
4. **Manual ban (admin)** — `POST /user/:id/ban` on A → immediate session eviction (reuses
   `forceLogout`) and the same auth-layer rejection as the automatic ban.
5. **Unban (admin)** — `POST /user/:id/unban` on A → `status` back to `active`, strikes/mute
   cleared, auth cache invalidated; A can send again immediately.
6. **Audit** — each step above writes an admin-visible audit entry (`USER_MUTED` /
   `USER_BANNED` / `USER_UNBAN`).

### Admin Account Setup
The first superadmin must be created directly in the database. No API endpoint assigns roles above `user`, keeping the attack surface minimal.

**Step 1 — Generate a bcrypt hash** (use the same `HASH_ROUNDS` value set in your `.env`):
```bash
node -e "const b=require('bcrypt'); b.hash('yourPassword', 12).then(h=>console.log(h))"
```
`bcrypt` only resolves inside the `backend/` directory, so run this in `backend/`, not at the repository root. On the docker compose stack, run it inside the container (the password goes in the `PW` env var):
```bash
echo "require('bcrypt').hash(process.env.PW, 12).then(h => console.log(h))" | docker compose exec -T -e PW='yourPassword' -w /app/backend chat node -
```

**Step 2 — Insert into the database** (Railway query runner, a DB client, or on the docker compose stack, pipe the SQL into `docker compose exec -T postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB>`):
```sql
INSERT INTO user_entity (email, password, role, "isAI")
VALUES ('superadmin@example.com', '<hash from step 1>', 2, false);
```

Role values: `user = 0`, `admin = 1`, `superadmin = 2`

**Railway**
1. Open Railway Dashboard → your PostgreSQL service → **Query** tab
2. Run the INSERT statement above


### Admin Panel
A separate React app (`admin/`) for admin/superadmin accounts, run locally at `http://localhost:5174` (see [Quick Start](#quick-start)) and deployed as its own Vercel project (see [Admin Panel - Vercel](#admin-panel---vercel)).

- **Dashboard** — total users (`humanOnly`, excludes the AI and moderation-system accounts), total rooms, users currently online, and the 5 most recent audit log entries.
- **Users** — paginated, sortable, searchable list; filter by moderation status (active/banned). Clicking a row opens a detail panel with moderation status and recent audit history. Actions (superadmin only where noted): promote/demote between `user`/`admin`; force logout, manual ban (optional reason, permanent or timed) / unban, and delete are restricted to accounts with a strictly lower role; a superadmin additionally gets a separate **Demote (superadmin)** action on peer superadmin accounts (see [Compromised Superadmin Containment](#compromised-superadmin-containment)); the AI/moderation-system accounts can never be deleted (see [Role](#role) invariants).
- **Rooms** — paginated, searchable list; clicking a row opens a detail panel (room ID, created date, participants). Delete a room.
- **Logs** — audit log filtered by action, user, and date range; **Export CSV** downloads the current filter as a file (same 10,000-row cap as the API).


### AI
Powered by Google Gemini 2.5 Flash. The `AiModule` contains two services:
- `AiService` — Gemini API calls, conversation history (last 10 messages), Redis distributed lock to prevent duplicate replies per room
- `AiRoomService` — per-room personality selection and retrieval

The AI companion's name is an alias, `Chattey`, set in the system prompt (`backend/src/ai/constants/system-prompts.ts`), different from the service name Chatterley.

**Personalities**
- `FRIENDLY`: General Q&A, warm and encouraging
- `CODING`: Programming expert with code examples
- `ENGLISH`: Grammar correction and natural phrasing
- `CREATIVE`: Storytelling, brainstorming, writing feedback

**Usage**
1. Click **AI Chat** in the Conversations banner
2. Select a personality when sending the first message
3. To change: click the **성격 변경** button (no change limit)

**Token Cost Optimization**
- Model: `gemini-2.5-flash` (cost-efficient Flash tier, not Pro)
- `maxOutputTokens: 300` hard-caps each response
- Conversation context limited to last 10 messages (`AI_HISTORY_LIMIT`) — avoids sending full history
- System prompt enforces 1-3 lines for casual/greetings, 4-5 lines for detailed questions (never more than 5)

**Rate Limiting & Cost Control**
- The same `RateLimitGuard` (10 messages/15s per user) applies to the `sendMessage` mutation, indirectly capping AI call frequency
- Redis distributed lock (`ai:lock:${roomId}`, 30s TTL) prevents concurrent duplicate AI replies within the same room
- AI reply is only triggered when the recipient is the AI user (`recipientId === aiUserId`)

**Response Delivery**
- Uses `generateContent()` for full response at once
- The complete AI reply is delivered as a single message through the same `receiveMessage :${roomId}` GraphQL Pub/Sub channel as human messages — there is no separate Socket.IO/WebSocket broadcast

**System Prompts**
- Each personality maps to a `systemInstruction` string passed to Gemini via `config.systemInstruction`
- Two shared rules apply across all personalities:
  - Language detection: always responds in the same language as the user's message
  - Length control: 1-3 lines for casual/greetings, up to 4-5 lines for questions needing explanation

**Error Handling**
- `handleReply` wraps all Gemini and DB calls in `try/catch/finally`: errors are logged and the Redis lock is always released in `finally`
- AI reply fires inside `setImmediate(...).catch(...)` in the resolver — failures are logged and do not affect the sender's message response
- Lock TTL (30s) auto-expires the lock if the server crashes mid-generation


### Test
To test out rate of success in test, Coverage Test is appropriate supporting tool for it.

#### Set Up
- Unit Testing

The tests codes are defined and can run in `spec.ts`.

Relocate testing directory from the relative path `src` to the separate root `["src"]` in 'Package.json'.

The directories wrapped in an array gives flexibility to add more test locations later such as e2e testing.

**Single base directory**
```json
"jest": {
  "rootDir": "src",
}
```

**Multi-base directories**
```json
"jest": {
  "roots": ["src"],
}
```

- Coverage Path Ignore
In `coveragePathIgnorePatterns`, it creates and passes in what not to test in 'Package.json'.
Coverage is measured mainly on the service layer. Controllers, gateways, guards, interceptors, and resolvers are left out of the measurement, but some are verified by their own specs (for example `gql-transaction.interceptor.spec.ts` and `query-rate-limit.guard.spec.ts`).
```json
"coveragePathIgnorePatterns": [
  "main.ts",
  "module.ts",
  "dto.ts",
  "entity.ts",
  "decorator.ts",
  "dec.ts",
  "strategy.ts",
  "guard.ts",
  "controller.ts",
  "gateway.ts",
  "interceptor.ts",
  "itc.ts",
  "role.ts",
  "logger.ts",
  "type.ts",
  "pubsub.service.ts",
  "resolver.ts",
  "data-source.ts",
  "migrations",
  "system-prompts.ts",
  "ai-personality.enum.ts",
  "all-exceptions.filter.ts"
],
```

- Directory Root
It sets output directory for coverage reports in parents directory, one level above the config file  in 'Package.json' so every testing files can be tested out all at once.
  - Subordinate repository
  ```json
    "coverageDirectory": "../coverage",
  ```

  - Parents repository
  ```json
    "coverageDirectory": "./coverage",
  ```

- Module Name Mapper
It maps module import paths using Regex to change `src/utils` into `<rootDir>/src/utils` in 'Package.json'.
```json
"moduleNameMapper": {
  "src/(.*)": "<rootDir>/src/$1",
  "^bcrypt$": "<rootDir>/src/mocks/bcrypt.ts"
}
```
`bcrypt` is replaced by `src/mocks/bcrypt.ts`, so the unit tests pass without a native build (confirmed in this verification: the backend tests passed in an environment installed with `--ignore-scripts`).

#### Test Coverage
**Test Results**
- Test Suites: 13 passed, 13 total (254 tests, re-measured on 2026-10-22)
- frontend Vitest: 4 files, 21 tests pass / admin Vitest: 3 files, 14 tests pass

**Coverage Results** (% Stmts, `pnpm test:cov` — re-measured on 2026-10-22, same values as 2026-07-16)
- Auth Service: 98.29%
- Chat Service: 97.72%
- Redis Service: 96.34%
- User Service: 100%
- AI Service: 96.7%
- AI Room Service: 100%
- Moderation Service: 99.21%
- Audit Log Service: 97.56%
- Mail Service: 100%

**Example Code**
```ts
  describe('ChatService', () => {
    let chatService: ChatService;
    let userRepository: Repository<UserEntity>;
    
    describe('getOrCreateRoom', () => {
      it('should get a created room', async () => {
        //* the mock family
        const mockSender = {
          id: 1,
          email: 'user1@gmail.com',
          password: 'pw',
          role: 0,
        } as UserEntity;
        const mockRecipientId = 2;
        const mockRecipient = { id: 2 } as UserEntity;
        const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;

        jest.spyOn(chatService, 'findRoom').mockResolvedValue(mockRooms);

        const result = await chatService.getOrCreateRoom(
          mockSender,
          mockRecipientId,
          mockManager as EntityManager,
        );

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(jest.mocked(chatService.findRoom)).toHaveBeenCalledWith(
          mockSender.id,
          mockRecipient.id,
          mockManager as EntityManager,
        );
        expect(result).toEqual(mockRooms);
      });
    });
  });
```


#### Migration Cascade Guard

`migration-cascade-guard.spec.ts` is a static guard (a text scan of migration source, not a
runtime unit test) that fails the build if any migration created **at or after** the CASCADE
was established re-adds a cascade-critical FK with the wrong `ON DELETE` action.

**What it protects.** `migration:generate` silently re-emits the ManyToMany join-table FK
`FK_501a0aef55632e3cf2894bda97f` (`room_entity_participants_user_entity`) as
`ON DELETE NO ACTION`, reverting the `ON DELETE CASCADE` that `UserService.remove` relies on
to clear a deleted user's room membership. The guard scans only each migration's `up()` — a
`down()` legitimately restores the prior action — and requires the CASCADE to survive. Earlier
migrations (which set the original `NO ACTION`) are exempt via a `since` timestamp, so the
original `InitialSchema` is not flagged.

**Why it rides `pnpm test`.** Lint is also a blocking CI step now, but it checks syntax/style,
not cross-migration FK history — the guard instead rides the test suite, which fires at two points:

| Fire point | Effect |
|---|---|
| Local `pnpm test` (dev branch) | Earliest catch — the moment a bad migration is generated and the dev runs tests |
| CI `test` job (main push/PR) | Blocking; `deploy` has `needs: test`, so a violation blocks the Railway prod deploy |

It is intentionally **not** run in prod: by prod boot `migration:run` has already executed the
migration against the live DB, so a source scan there is too late — it would only convert data
corruption into a boot outage. The correct catch layers are local + CI. To extend it, add an
entry to the `GUARDED_FKS` array in the spec.

### Deployment
#### Frontend - Vercel
**CI/CD Flow**
`git push origin main` => Vercel Auto-deploy

**Config**
- Root Directory: `frontend/`
- `pnpm-workspace.yaml` for monorepo package resolution


#### Admin Panel - Vercel
Deployed as a **separate Vercel project**, same pattern as the frontend. Not part of GitHub Actions — Vercel builds and deploys on push independently.

**CI/CD Flow**
`git push origin main` => Vercel Auto-deploy

**Config**
- Root Directory: `admin/`
- `pnpm-workspace.yaml` for monorepo package resolution
- Env vars: `VITE_API_URL` (same backend as frontend)


#### Public - Railway
**CI/CD Flow**
`git push origin main` => GitHub Actions (`test` → `e2e` + `admin-e2e`). `deploy` (Railway CLI =>
Auto-deploy) runs only on manual dispatch (`workflow_dispatch`) while hosting is stopped — full CI
job breakdown in [CONTRIBUTING.md](CONTRIBUTING.md#before-submitting-a-pr)

**Setup (one-time)**
1. Add `RAILWAY_TOKEN` in GitHub => Settings => Secrets => Actions
2. Set `.env` variables in Railway Dashboard => Variables tab
3. Add Redis plugin in Railway (replaces local Docker Redis) — its connection string ships with a
   password by default, and with `ENV=prod` set, `app.module.ts`'s Joi schema now refuses to boot
   if `REDIS_URL` ever ends up without one

**Config Files**
- 'railway.toml' builds with Dockerfile, runs `cd backend && pnpm migration:run && node dist/main` on deploy


#### Local - Docker
Using Docker to deploy and run Redis server

- Run Redis Container
`docker run -d -p 6379:6379 --name redis-chat redis:latest`

- Show 'redis-chat' container
`docker ps`

- Verify Redis Connection
`docker exec -it redis-chat redis-cli ping` => PONG


#### Redis Container Usage
Start Redis
`docker start redis-chat`

Stop Redis
`docker stop redis-chat`

Remove container (keeps image)
`docker rm redis-chat`


## Debugging List
Recurring problem types met during development.
- Incorrect TypeORM queries in service
- Mismatching property name with entity schema
- Missing `commitTransaction()` to messages will appear in DB
- Creating new rooms repeatedly when send message each time
- Sending wrong recipient ID from frontend
- Failing find sender ID

For the full root-cause narratives behind issues of this kind (not just the one-line summary), see [AI-Assisted Development Notes](#ai-assisted-development-notes) below.


## Scale Up In Future
**Current limits**
- Redis Pub/Sub is at-most-once, so a message published while nobody is subscribed is not delivered again ([ADR 0004](ADR/0004-graphql-socketio-api-layer-split.md))
- Room create/lookup logic assumes exactly two participants, so group chat is not supported ([ROADMAP.md](ROADMAP.md))
- `GEMINI_API_KEY` is a required env var, so the app does not boot without a key
- Hosting is stopped, so behavior on a deployed environment was not checked
- Multi-instance runs and load were not measured
- The first superadmin has to be inserted into the DB by hand
- The `admin-e2e` job is not blocking yet, and the Windows `test` job passes even when it fails ([deploy.yml](.github/workflows/deploy.yml))
- frontend and admin have no error tracking (Sentry covers the backend only)

**Unimplemented backlog** (not a committed priority order; details in [ROADMAP.md](ROADMAP.md))
- Last message and unread count on the conversation list
- Group chat
- User-facing room and conversation deletion
- "User is typing" indicator
- Rate limiting on the `receiveMessage` subscription
- Error tracking for frontend and admin


## AI-Assisted Development Notes

### Case: Infrastructure Security Threat Detected During Live Testing

An infrastructure-level vulnerability — difficult to catch through code review or unit tests alone — was discovered and remediated during an AI-assisted live testing session.

**How it was found**
During live API testing with Swagger and curl, AI (Claude Code) reviewed the Docker Compose configuration and identified the following:
- All service ports were bound to `0.0.0.0:PORT:PORT`, exposing them on every network interface
- The development machine's Ethernet adapter held a public IP while the Windows Firewall profile was set to "Private (trusted)", activating a Docker Desktop firewall rule that allowed inbound connections on any port
- Result: PostgreSQL (5432), Redis (6379), and the backend (3000) were reachable from the internet

**Confirmed damage**
An automated ransomware bot accessed PostgreSQL using default credentials, wiped the databases, and left a Bitcoin ransom note in a `readme` table inside a newly created `readme_to_recover` database.

**What the AI did**
1. Changed Docker port bindings from `0.0.0.0` to `127.0.0.1` (`docker-compose.yml`)
2. Restricted `backend/src/main.ts` host binding to `127.0.0.1` in the development environment
3. Added Redis `requirepass` authentication
4. Rotated DB password, Redis password, and JWT Access/Refresh secrets
5. Guided the developer to switch the Windows Firewall profile to Public (performed by the developer directly)

**What the AI deliberately did not do — prompt injection prevention**
The AI did not issue a SQL query to read the contents of `readme_to_recover.readme`. If an attacker had embedded AI instructions inside the DB row, loading that text into the AI's context window could have caused unintended tool calls. The AI described the table's location and existence, then delegated content inspection to the developer. The developer confirmed it was a standard ransom demand.

**Response order — containment first**
Deleting the ransomware database first was considered, but doing so while the access path was still open would have been ineffective — the bot could recreate it immediately. The following order was followed instead:
1. Network containment (port bindings + firewall profile)
2. Credential rotation
3. Artifact cleanup

**Takeaways**
- AI-assisted live testing surfaces deployment-environment vulnerabilities that code review and CI pipelines alone would miss
- Having an AI tool directly read externally created content (DB rows, uploaded files) creates a prompt injection vector — a human must read and summarize the content instead
- The correct incident response order is **contain → rotate → clean**. Reversing the order makes cleanup ineffective

### Case: AI Reply Cache Corruption Found During Live Browser Testing

While manually verifying a newly added AI-reply retry/fallback feature in a live browser session, a console error (`CombinedGraphQLErrors: Invalid time value`) appeared after a backend restart triggered a socket reconnect, which reloaded the room's message history from cache.

**Root cause**
`AiService` cached its own reply directly, and `PubSubService`'s publish-time hook cached it a second time — but using a `plainToClass`'d copy whose `@Exclude()`-decorated `created` field had been stripped. The corrupted cache entry later round-tripped through `getCachedMessages` as `new Date(undefined)` (a valid `Date` instance, but internally `NaN`), which crashed GraphQL's default `DateTime` scalar (`value.toISOString()`) the next time a cache-served `getMessages` read included it.

**What the AI did**
1. Verified the DB `created` column directly via `psql` to rule out data corruption at the source
2. Read `@nestjs/graphql`'s actual `DateTime` scalar implementation to confirm the exact throw condition
3. Traced both cache-write call sites (`ai.service.ts`, `pubsub.service.ts`) to find the duplicate, inconsistent caching path
4. Used `git show --stat` on the historical caching-refactor commit to confirm the duplication was a leftover oversight (that refactor never touched `ai.service.ts`), not an intentional design
5. Fixed by publishing the raw entity from `AiService` (matching the human-message path) and removing the now-redundant direct cache call
6. Added regression coverage: a `getCachedMessages` case for a missing `created` field, and a new `pubsub.service.spec.ts`

**Takeaways**
- Live browser testing surfaced a cross-service bug that unit tests never could — the existing mocks isolated exactly the layer (`PubSubService`'s cache-on-publish side effect) where the corruption occurred
- Git history tracing (`git show --stat` on the suspected commit) can objectively confirm "leftover from an incomplete refactor" vs. "intentional design," rather than guessing


## Related Documents
- [ARCHITECTURE.md](ARCHITECTURE.md) — module dependency graph, guard chains, deployment topology
- [CONTRIBUTING.md](CONTRIBUTING.md) — local setup, branch/commit conventions, PR checklist
- [CHANGELOG.md](CHANGELOG.md) — full commit history
- [ADR/](ADR/) — formal architecture decision records


## License
MIT — see [LICENSE](LICENSE).
