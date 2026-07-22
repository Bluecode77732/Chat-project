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

# Real-Time Chat Application
- A private one-to-one real-time chat service, built solo over 636+ commits (2026-01 ~ present) as an iterative deep dive into Socket.IO, Redis, authentication, and — later — a live security incident and a behavioral moderation system.
- Started as a minimal validated-user chat prototype and grew into a system with an AI chat companion, a separate admin panel, behavioral moderation, and CI/CD across three deployed services.


## Overview
A real-time private one-to-one chat service, iterated over 6+ months (636+ commits) from an initial prototype through an architecture migration, a live security-incident response, and a behavioral moderation system.
- Authentication: JWT-based auth with Passport strategies; refresh token in an httpOnly cookie, access token in memory only
- Chat Management: Socket.IO (connection lifecycle only) + GraphQL (Mutation/Subscription for messages), Redis-backed session/cache with transaction-safe writes
- Moderation: automatic strike-based abuse detection (duplicate/flood + velocity) escalating warn → mute → timed/permanent ban, with admin recovery tools
- AI Chat: Google Gemini 2.5 Flash with 4 selectable personalities, cost-capped (token limits, retry ceiling)
- Admin Panel: separate React app for user/room management, moderation actions, and audit-log export
- API Documentation: Swagger integration + Altair & GraphQL
- Testing: unit tests across core service layers (see [Test Coverage](#test-coverage) for exact per-service numbers) plus Playwright e2e for both the main app and the admin panel

Two real incidents hit during development — a live infrastructure security exposure and an AI-reply cache-corruption bug — are written up with full root-cause analysis in [AI-Assisted Development Notes](#ai-assisted-development-notes).


## Project Motivation
- Built solo, iterating live over 636+ commits (2026-01-02 ~ present): Socket.IO connection handling, Redis session/cache/pub-sub, and the tradeoffs between raw WebSocket messaging and GraphQL Subscriptions for real-time delivery
- Migrated the message-delivery path from direct Socket.IO message passing to a GraphQL Mutation/Subscription split with transactional guarantees **while the app was already working**, to learn what that kind of change actually costs in a live system, not just on paper
- Practiced authentication/authorization end-to-end — Basic/Bearer/JWT, RBAC guards — including finding and fixing a self-discovered XSS/localStorage token-storage vulnerability
- Handled a live security incident (an exposed local dev port that led to a ransomware bot wiping the dev database) end-to-end: containment, credential rotation, cleanup — documented as a case study, not glossed over
- Kept KISS/YAGNI as a default, but didn't stop at a feature demo: added a behavioral moderation pipeline, a separate admin panel, and CI/CD (GitHub Actions + Railway/Vercel) the way a real service would need them


## Live Demo
- Frontend: https://chat-project-frontend-ten.vercel.app
- REST API: https://chat-project-production-3b22.up.railway.app
- WebSocket: wss://chat-project-production-3b22.up.railway.app


## Quick Start
- Prerequisites
  - Node.js >= v24.xx
  - Nest.js >= v11.xx
  - PostgreSQL 18
  - pnpm >= 10 (exact pinned version tracked in [CONTRIBUTING.md](CONTRIBUTING.md#prerequisites)) or npm >= v10.xx
  - Docker >= v28.xx

**Install dependencies**
```powershell
pnpm install
```

**Setup environment** — copy to `backend/.env` and fill in your credentials.
```powershell
cp backend/.env.example backend/.env
```

**Create database schema via migrations**
```powershell
cd backend
pnpm migration:run
```

**Run Redis in Docker**
```powershell
docker start redis-chat
```

**Run backend** (cd backend first)
```powershell
cd backend && pnpm start:dev
```

**Run frontend** (separate terminal) — copy the template and adjust if your backend runs elsewhere:
```powershell
cp frontend/.env.example frontend/.env.local
cd frontend && pnpm install && pnpm dev
```
→ http://localhost:5173

**Run admin panel** (separate terminal) — copy the template (no adjustment usually needed):
```powershell
cp admin/.env.example admin/.env.local
cd admin && pnpm install && pnpm dev
```
→ http://localhost:5174 — see [Admin Panel](#admin-panel) for what it does; requires an admin/superadmin account (see [Admin Account Setup](#admin-account-setup))

**Test chat communication** — chat messages go over GraphQL (Mutation to
send, Subscription to receive). Socket.IO only handles connection lifecycle
and room-creation notifications; it carries no chat-message traffic. See
**API Documentation → Key Endpoints → Chat** below for the Altair/Postman
GraphQL walkthrough.

**Run all tests**
```powershell
pnpm test
```

**Run test coverage** (cd backend first)
```powershell
cd backend && pnpm test:cov
```

**Access Swagger UI** — http://localhost:3000/document


### Troubleshooting
List of Troubleshooting when the program runs
- Redis connection
  - Log: "GraphQLModule dependencies initialized"
  - Log: "Redis Error: AggregateError [ECONNREFUSED]"
  - Log: "Error: connect ECONNREFUSED ::IPv6 address:port"
  
  - Solution 
    - ✅ Open terminal to run `docker start redis-chat`

- Connection failure
  - Log: "Failed to send message: Sender isn't online"
  - Log: "Failed to send message: Cannot Find Sender ID"

  - Solution 
    - ✅ Most likely the reason is, the server cannot find request from the correct path in header through HTTP or TCP socket. If when request is not delivered in forms of user's id or sub, requires to be fixed in 'Guard' or 'Decorator' where modified pathway of requests.


- Message saving failure in DB

  - Solution 
    - ✅ Take a look at `backend/src/chat/interceptor/gql-transaction.interceptor.ts`, which owns the transaction elements: `commitTransaction()`, `rollbackTransaction()`, `release()`. The commit runs after the resolver returns, so check that any post-commit logic awaits `ctx.req.transactionCommitted`.


## API Documentation
### Swagger UI
***To try all of'em, you must register first to get started.***
Since Altair cannot test with Mutation, while Postman cannot test Subscription, each platforms take a role as Subscription and Mutation separately to test chat communication altogether.

### Key Endpoints
**Swagger**
Test 'Auth' and 'User' Endpoints URL below.
- URL: `http://localhost:3000/document`

**Health**
- `GET /health` - Liveness check, no auth — used by Railway's `healthcheckPath`; returns `{ status: 'ok' }` without checking DB/Redis (a dependency outage should not force a container restart)

**Authentication**
- `POST /auth/register` - Register with Basic Auth — optional body `{ nickname? }`; rate-limited to 10 attempts/60s per IP (429 on exceed)
- `POST /auth/signin` - Get JWT tokens — same 10 attempts/60s per-IP rate limit as register
- `POST /auth/signOut` - Blacklists the current access token and clears the refreshToken cookie (cookie is cleared even if the token is already expired/invalid)
- `POST /auth/token/refreshaccess` - Refresh access token

**User** — account creation happens via `POST /auth/register` above, not here
- `GET /user` - List users **(admin only)** — query params: `page`, `take`, `sort` (`ASC`/`DESC`), `sortBy` (`id`/`role`/`created`), `search` (email/nickname), `status` (`active`/`banned`), `humanOnly` (excludes the seeded AI and moderation-system accounts)
- `GET /user/:id` - Get a user (own account or admin)
- `PATCH /user/:id` - Update a user (own account or admin) — optional body `{ email?, password?, nickname?, profileImage? }` (nickname ≤20 chars, must be unique; profileImage as a base64 data URI, jpeg/png/webp, ≤2MB); 400 if the nickname is already in use
- `PATCH /user/:id/role` - Change user role **(superadmin only)**
- `POST /user/:id/force-logout` - Force logout a user **(admin only)**
- `POST /user/:id/ban` - Manually ban a user, independent of the automatic strike system **(admin only)** — optional body `{ reason?, durationSec? }` (omit `durationSec` for a permanent ban); also evicts any active session
- `POST /user/:id/unban` - Clear a user's ban / mute / strikes **(admin only)**
- `DELETE /user/:id` - Delete a user (own account or admin) — the seeded AI and moderation-system accounts cannot be deleted

**Audit Log**
- `GET /audit-log` - Paginated audit log entries **(admin only)** — query params: `action` (`ROLE_CHANGE`/`FORCE_LOGOUT`/`USER_DELETE`/`USER_UNBAN`/`USER_MUTED`/`USER_BANNED`), `userId` (matches as actor OR target), `from`/`to` (ISO 8601 date range), `page`, `take`, `sort`
- `GET /audit-log/export` - Export the same filtered results as CSV, capped at 10,000 rows (low-volume privileged-action data, so a flat cap is simpler than cursor streaming) **(admin only)**

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
  - Description: This platform cannot be altered. Open a tap of GraphQL in 'Postman', and set the pre-requisition as following, then connect to the Altair. If this all set, you are ready to test messaging communication as sender.

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


## Stacks
### Frontend
A minimal React + TypeScript client built to demonstrate end-to-end integration with the backend.

- Stack: React 19.2.5, TypeScript ~6.0.2, Vite 8.0.10, Tailwind CSS 4.2.4, Zustand 5.0.12, Apollo Client 4.1.9, Socket.IO Client 4.8.3 ✔
- Auth: access token in memory (Zustand), refresh token in a backend-set httpOnly cookie — never in localStorage ✔
- Real-time: Socket.IO for connection/room management, GraphQL Mutation/Subscription for messaging ✔
- Security: XSS prevention via DOMPurify, CORS-compliant requests, Route Guard for protected pages ✔
- Deployment: Vercel (auto-deploy on push) ✔

### Backend
- **Language**: TypeScript 5.7.3 — static typing across backend/frontend/admin catches the class of `undefined`-property bugs this project hit repeatedly during its early raw-debugging phase (see commit history, Jan–Mar)
- **Runtime**: Node.js 24.x (pinned via `.nvmrc` / `engines`) — non-blocking I/O suits a connection-heavy chat workload
- **Framework**: NestJS 11.1.19 — DI-based module boundaries kept the feature surface (auth/chat/moderation/ai/admin) decoupled as it grew from a single resolver to a dozen+ modules
- **Architecture**: Monolith, single deployable — module boundaries (see [Project Structure](#project-structure)) provide separation without paying for service-mesh complexity this scale doesn't need
- **Realtime split**: Socket.IO 4.8.3 for connection lifecycle only (auth on connect, room-creation notifications) + GraphQL 16.12.0 Mutation/Subscription for chat messages (see [Flow](#flow)) — not the original design; messages were migrated off raw Socket.IO mid-project to get transactional guarantees around persistence (`GqlTransactionInterceptor`)
- **Database**: PostgreSQL + TypeORM 0.3.29 — relational integrity for interdependent user/room/chat/audit-log data; migrations only (`synchronize: false`) so schema changes stay reviewable
- **Cache / Pub-Sub**: Redis via ioredis 5.9.3 — session/online-status, a per-room recent-message cache, and `@socket.io/redis-adapter` for horizontal scaling (without it, room broadcasts don't cross server instances)
- **AI**: Google Gemini 2.5 Flash via `@google/genai`, 4 selectable personalities — cost-capped by design (output token limit, conversation-history truncation, retry ceiling), not bolted on after the fact
- **Auth**: JWT (access token in memory, refresh token in an httpOnly cookie) + Passport strategies; RBAC guards are composed at both the REST and GraphQL layer, not subclassed
- **Testing**: Jest unit tests on the service layer (see [Test Coverage](#test-coverage)), Playwright e2e for both `frontend/` and `admin/`
- **API Docs**: Swagger for REST + GraphQL introspection via Altair — REST and GraphQL each need their own tool since neither Altair nor Postman alone can exercise both message-sending paths


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


## Architecture
### Project Structure
```
Chat Project/                   <= monorepo root
├── backend/                    <= NestJS application
│   └── src/
│       ├── ai/                 <= Gemini AI (AiService, AiRoomService)
│       │   ├── constants/      <= system-prompts.ts, AI_USER_EMAIL
│       │   ├── entities/       <= AiRoomEntity (room's active AI personality, split out of RoomEntity)
│       │   └── enums/          <= ai-personality.enum.ts
│       ├── audit-log/          <= AuditLogController, AuditLogService (privileged-action audit trail, CSV export)
│       │   └── dto/            <= AuditLogQueryDto, AuditLogExportQueryDto
│       ├── auth/               <= JWT auth, guards, strategies
│       │   ├── decorator/
│       │   ├── dto/
│       │   ├── guard/          <= JwtAuthGuard, RbacGuard, GraphqlAuthGuard
│       │   ├── interface/      <= Payload (JWT payload shape)
│       │   ├── role/
│       │   └── strategy/       <= passport-local, passport-jwt
│       ├── base/
│       │   ├── entity/         <= EntityBase (created/updated timestamps)
│       │   ├── filter/         <= AllExceptionsFilter (global HTTP+GraphQL error normalization)
│       │   └── logger/         <= winston logger
│       ├── chat/               <= ChatGateway, ChatService, ChatResolver
│       │   ├── decorator/      <= gql-query-runner.decorator
│       │   ├── entities/       <= ChatEntity, RoomEntity
│       │   │   └── dto/        <= CreateChatDto
│       │   ├── guard/          <= RateLimitGuard
│       │   └── interceptor/    <= GqlTransactionInterceptor
│       ├── graphql/            <= PubSubService, GraphQL input/return types
│       ├── health/             <= HealthController (liveness probe, GET /health)
│       ├── mail/                <= MailService (SMTP notifications, e.g. role-change emails)
│       ├── migrations/         <= TypeORM migration files
│       ├── mocks/              <= bcrypt mock for tests
│       ├── moderation/         <= ModerationService, ModerationGuard (strike ladder, ban/mute enforcement)
│       │   ├── constants/      <= thresholds, system-account email, notice texts, redis keys
│       │   └── enums/          <= moderation-status.enum.ts (active | banned)
│       ├── redis/              <= RedisModule, SessionCacheService
│       │   └── interface/      <= CachableMessage (shared with graphql/pubsub.service.ts)
│       └── user/               <= UserController, UserService, UserEntity
│           ├── dto/
│           └── entities/
├── frontend/                   <= React + Vite application (chat UI, port 5173)
│   └── src/
│       ├── api/                <= apollo.ts, axios.ts, graphql-operations.ts
│       ├── auth/               <= session-guard.ts (silent token refresh, cross-tab conflict detection)
│       ├── components/         <= ProtectedRoute, AiPersonalitySelector, EmptyStateNotice, RateLimitNotice
│       ├── pages/               <= ChatPage, SigninPage, RegisterPage, AccountPage
│       ├── socket/              <= socket.ts (Socket.IO singleton)
│       ├── store/                <= auth.store.ts (Zustand)
│       └── types/
└── admin/                       <= React + Vite admin dashboard (port 5174) — see Admin Panel
    └── src/
        ├── api/                <= apollo.ts, axios.ts, graphql-operations.ts
        ├── auth/               <= session-guard.ts (silent token refresh, cross-tab conflict detection)
        ├── components/         <= ProtectedRoute
        ├── pages/               <= LoginPage, DashboardPage, UsersPage, RoomsPage, LogsPage
        ├── store/                <= auth.store.ts (Zustand)
        └── test/                 <= Vitest setup (jest-dom matchers, RTL cleanup)
```

### Hybrid Storage Pattern
- Redis(session/cache): It stores `userId` => `socketId` mapping for consistent data flow and shareable servers
- In-Memory(socket): It stores `socketId` => `Socket` objects which requires WebSocket operation which is easy implement and able to communicate in real-time
- Reason for utilizing both: Redis holds serialized objects as 'JSON' format, while socket holds as long as client is connected via TCP-level connection. Therefore, clients are enabled to reconnect with their session/cache data.

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
  1.2. `ChatService.registerClient()` maps `userId` => `socketId`/Socket
  1.3. `ChatService.joinRooms()` joins the client to their existing rooms
  1.4. On a session conflict, the previous socket for that user receives `forceLogout` and is disconnected

2. Room creation notification
  2.1. When `ChatService` creates a new `RoomEntity` (first message between two users), it
       emits `CreateRoom` to the recipient's socket so their client can join the new room

3. Client disconnects
  3.1. `handleDisconnect` runs in `chat.gateway.ts`
  3.2. `ChatService.removeClient()` removes the `socketId` entry from the in-memory Map

### GraphQL Mutation Path (`sendMessage`)
1. Client calls `sendMessage` mutation
  1.1. `GraphQLAuthGuard` + `RateLimitGuard` run
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
  DB_TYPE=yourDatabase
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

  # Expiry
  REFRESH_TOKEN_SECRET_EXPIRES_IN=expiryTime
  ACCESS_TOKEN_SECRET_EXPIRES_IN=expiryTime

  # Redis Configuration
  REDIS_URL=redis://user:password@host:port

  # Redis TTL (seconds)
  USER_CACHE_TTL_SEC=300
  SESSION_TTL_SEC=86400
  MESSAGE_CACHE_TTL_SEC=86400

  # CORS URL Set Up
  CORS_ORIGIN=your.vercel.app

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
- `git push` will automatically get the app through the process of testing and deploying as model of Dockerfile.

#### Local - docker-compose
Running all of services through Docker

- Requires `.env.local` at the project root (copy from `backend/.env.example` and adjust — `NODE_ENV=docker`)

- Start all of services
`docker compose up -d --build`

- Abort all of services
`docker compose down -v`

- Run DB migration
`docker compose exec chat pnpm migration:run`

- Check logs
`docker compose logs -f chat`

- Show 'chat' container
`docker ps`

- Verify Connection
`docker compose exec redis redis-cli ping`


#### Usage
See **Deployment → Local - Docker → Redis Container Usage** below for the redis-chat container start/stop/remove commands (kept in one place to avoid drift between two copies).


### Auth
Implementation of two ways of sign-in endpoints.
- Basic Authentication
  - The clients need to submit username and password, encoded by 'base64', which converts binary data into plain text to transmit safely, to verify credentials.
- Token-based Authentication
  - When the clients logs in, they can get token formed as JWT(Javascript Web Token), then server sends token on subsequent requests, which is authenticated, instead of your credentials in Basic Authentication, so the server validates the token


### User
- A casual user managing service that has basic CRUD endpoints and persistent data savings in via TypeORM. 
- NestJs dependency injection technique for easier and cleaner modular implementation.


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

**Step 2 — Insert into the database** (Railway query runner, `psql`, or any DB client):
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
- **Users** — paginated, sortable, searchable list; filter by moderation status (active/banned). Clicking a row opens a detail panel with moderation status and recent audit history. Actions: promote/demote (superadmin only), force logout, manual ban (optional reason, permanent or timed) / unban, delete — restricted to accounts with a strictly lower role, and the AI/moderation-system accounts can never be deleted (see [Role](#role) invariants).
- **Rooms** — paginated, searchable list; clicking a row opens a detail panel (room ID, created date, participants). Delete a room.
- **Logs** — audit log filtered by action, user, and date range; **Export CSV** downloads the current filter as a file (same 10,000-row cap as the API).


### Redis
- Without Redis, connection state (`socketId`, online status) would live only in the process's own memory — fine for a single instance, but invisible to every other instance once the app scales horizontally. Redis stores that metadata centrally so any instance can look up where a user is connected, and doubles as the message cache and pub/sub bridge described above.

#### Compare Sample Code 
Socket In-memory
```ts
  // Before Redis
  registerClient(participantId: number, client: Socket) {
    this.clientConnection.set(participantId, client);
  };
```

Redis with In-Memory
```ts
  // After Redis
  async registerClient(participantId: number, client: Socket) {
    await this.redisService.sethUserOnline(participantId, client.id);
    this.clientConnection.set(client.id, client);
  };
```


### AI
Powered by Google Gemini 2.5 Flash. The `AiModule` contains two services:
- `AiService` — Gemini API calls, conversation history (last 10 messages), Redis distributed lock to prevent duplicate replies per room
- `AiRoomService` — per-room personality selection and retrieval

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
  "src/(.*)": "<rootDir>/src/$1"
}
```

#### Test Coverage
**Test Results**
- Test Suites: 12 passed, 12 total

**Coverage Results** (% Stmts, `pnpm test:cov` — as of 2026-07-16)
- Auth Service: 100%
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
**Live Demo**
- Live URL: https://chat-project-frontend-ten.vercel.app

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
**Live Demo**
- Live URL: https://chat-project-production-3b22.up.railway.app

**CI/CD Flow**
`git push origin main` => GitHub Actions (`test` → `e2e` + `admin-e2e` → `deploy`) => Railway CLI =>
Auto-deploy — full CI job breakdown in [CONTRIBUTING.md](CONTRIBUTING.md#before-submitting-a-pr)

**Setup (one-time)**
1. Add `RAILWAY_TOKEN` in GitHub => Settings => Secrets => Actions
2. Set `.env` variables in Railway Dashboard => Variables tab
3. Add Redis plugin in Railway (replaces local Docker Redis)

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


#### Check User Data

- Terminal command
`docker compose exec redis redis-cli`

- Check keys
`KEYS user:*`

- Check data
`HGETALL user:<user_number>`

- Result
`HGETALL user:1`
1) "socketId"
2) "user's connection ID"
3) "status"
4) "online"

`HGETALL user:2`
1) "socketId"
2) "user's connection ID"
3) "status"
4) "online"


## Debugging List
- Incorrect TypeORM queries in service
- Mismatching property name with entity schema
- Missing `commitTransaction()` to messages will appear in DB
- Creating new rooms repeatedly when send message each time
- Sending wrong recipient ID from frontend
- Failing find sender ID

For the full root-cause narratives behind issues of this kind (not just the one-line summary), see [AI-Assisted Development Notes](#ai-assisted-development-notes) below.


## Scale Up In Future
Moved to [ROADMAP.md](ROADMAP.md).


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
- [Architecture Diagrams](https://claude.ai/code/artifact/29b14132-8dd8-4b1b-bb28-f21d3ab27b44) — 14
  code-verified sequence/flowchart/ERD diagrams (auth, `sendMessage`, sockets, AI, moderation, Redis,
  guards, modules); a private link, not indexed elsewhere in the repo


## License
MIT — see [LICENSE](LICENSE).