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

> 한국어 버전: [README.ko.md](README.ko.md)

# Real-Time Chat Application
- An classical private One-to-One chatting server-side management application that validated users can chat with the other user.
- This project is for understanding how socket.io can make two entities communicate each other, caching and rate-limiting with Redis, persistent session, and save their chat logs in server.


## Overview
A casual private One-to-One chatting project that enables communication real-time.
- Authentication: JWT-based auth with Passport strategies
- Chat Management: Socket and Redis session & cache connection with transaction safety
- AI Chat: Google Gemini 2.5 Flash with 4 selectable personalities
- API Documentation: Swagger integration + Altair & GraphQL
- Testing: Unit tests with approximate +90% coverage on core logic


## Project Motivation
- To understand implementation of the chat using `Socket.IO` In-Memory storage, `Redis` Session and Cache.
- Understanding of user authentication and authorization using basic, bearer and JWT.
- Following style of 'Keep It Simple Solid', and 'You Are not Gonna Need It' for readable and solid programming.
- To gain technical knowledge of communication between one-to-one private Chat.


## Live Demo
- Frontend: https://chat-project-frontend-ten.vercel.app
- REST API: https://chat-project-production-3b22.up.railway.app
- WebSocket: wss://chat-project-production-3b22.up.railway.app


## Quick Start
- Prerequisites
  - Node.js >= v24.xx
  - Nest.js >= v11.xx
  - PostgreSQL >= v17.xx
  - pnpm (recommended) or npm >= v10.xx
  - Docker >= v28.xx

```md
  # Install dependencies
  ```powershell
  pnpm install
  ```
  
  # Setup environment
  Copy to `backend/.env` and fill in your credentials.
  ```powershell
  cp backend/.env.example backend/.env
  ```
 
  # Create database schema via migrations
  ```powershell
  cd backend
  pnpm migration:run
  ```

  # Run Redis in Docker
  ```powershell
  docker start redis-chat
  ```

  # Run backend (cd backend first)
  ```powershell
  cd backend && pnpm start:dev
  ```

  # Run frontend (separate terminal)
  Copy `frontend/.env.local` and set backend URLs.
  ```powershell
  cp frontend/.env.local frontend/.env.local
  ```
  ```env
  VITE_API_URL=http://localhost:3000
  VITE_WS_URL=ws://localhost:3000
  ```
  ```powershell
  cd frontend && pnpm install && pnpm dev
  ```

  # Local Test Socket Chat
  # Open Postman Socket (Recommended)
  # Option: A
  1. Open two Socket.IO taps on 'Postman', enter `ws://localhost:3000` in URL.
  2. Register and login to get access token.
  3. Go to Headers and insert 'authorization' as key, 'Bearer token' as value for each taps where you want to communicate to.
  4. Connect both taps together, and open terminal, or go to `logs.log` file, to find which rooms "recipientId" did join.
  5. Go to Message and type "message", "recipientId" as JSON format, and fill in the values in Message field on each taps.
  6. Set 'sendMessage' footer under the Message field, for both taps, then send message.

  # Open Altair and Postman
  # Option: B
  See details in the **API Documentation**, **Key Endpoints**, **Chat** section below.

  # Run all tests
  pnpm test

  # Run test coverage (cd backend first)
  cd backend && pnpm test:cov
  
  # Access Swagger UI
  http://localhost:3000/document
```md


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

**Authentication**
- `POST /auth/register` - Register with Basic Auth
- `POST /auth/signin` - Get JWT tokens
- `POST /auth/token/refreshaccess` - Refresh access token

**User**
- `GET /user` - Get all users **(admin only)**
- `GET /user/:id` - Get a user (own account or admin)
- `POST /user` - Create a user
- `PATCH /user/:id` - Update a user (own account or admin)
- `PATCH /user/:id/role` - Change user role **(superadmin only)**
- `POST /user/:id/force-logout` - Force logout a user **(admin only)**
- `DELETE /user/:id` - Delete a user (own account or admin)

**Audit Log**
- `GET /audit-log` - Get last 100 audit log entries **(admin only)**

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
        "message": "Sent from Postman",
        "recipientId": 2,
        "room": 19
      },
      "recipientId": 2
    }
    ```


- GraphQL (Queries & Additional Mutations)
  - URL: `http://localhost:3000/graphql`
  - Headers: `authorization: Bearer token`

  **Queries**
  - `getMessages(roomId: Int!, cursor?: Int)` => `[MessageType]` — Fetch up to 15 messages before the cursor (cursor-based pagination)
  - `getMyRooms` => `[RoomInfoType]` — List all rooms the authenticated user belongs to
  - `getRoom(recipientId: Int!)` => `Int` — Return the room ID shared with a recipient, or null if none
  - `getOnlineUser` => `[Int]` — List user IDs currently marked online in Redis
  - `getAllUsers` => `[Int]` — List all user IDs except the caller
  - `getAiUserId` => `Int` — Return the system AI user's ID
  - `getAiPersonalityInfo(roomId: Int!)` => `AiPersonalityInfoType` — Return the active personality for the room

  **Mutations**
  - `setAiPersonality(roomId: Int!, personality: AiPersonality!)` => `Boolean` — Set or change the AI personality for a room

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

- Stack: React, TypeScript, Vite, Tailwind CSS, Zustand, Apollo Client, Socket.IO Client ✔
- Auth: JWT stored in memory (Zustand) with refresh token persistence via localStorage ✔
- Real-time: Socket.IO for connection/room management, GraphQL Mutation/Subscription for messaging ✔
- Security: XSS prevention via DOMPurify, CORS-compliant requests, Route Guard for protected pages ✔
- Deployment: Vercel (auto-deploy on push) ✔

### Backend
- Language: Typescript, a type-safe and a solid object oriented language, superset of Javascript. ✔
- Backend: Node.Js, this javascript runtime built with chrome V8 engine, provides ecosystem where the applications run smoothly. ✔
- Framework: Nest.Js, a scalable framework for Typescript project, and a powerful framework that is keep rising. ✔
- Architecture: Monolithic Architecture, a principle for casual-fitting project and easy to couple and decouple unit of components. ✔
- Socket: Socket.IO, as written Nestjs official documentation, this middleware package provides method how to handle format as multipart/form-data, through HTTP request by Post method, which make the application easy to handle. ✔
- AI: Google Gemini 2.5 Flash for AI chat responses with selectable personalities ✔
- Authentication: JWT Authentication; authenticate user validation for using the application ✔
- Guard: allow validated only types of data ✔
- Interceptor: a middleware to manipulate user's data ✔
- Role Based Access: differ levels of user by authorization class ✔
- Chat: major websocket implementation ✔
- Cache: Redis for message rate-limit and store user's data efficiently. ✔
- Filter: exception handlers ✔
- Logger: records events, error, debug infos while executing the application ✔
- Unit Test: Testing service methods by each unit ✔
- Swagger: Documenting by methods to test each of endpoints ✔


## Features
- Real-time bidirectional messaging
- Rate limiting - 10 messages per 15s/user
- Persistent user sessions across server restarts
- Private chat rooms between users
- Transaction-safe message storage & delivery
- Horizontal scaling ready - Redis-backed session
- AI chat powered by Google Gemini 2.5 Flash (4 personalities: Friendly, Coding, English, Creative)
- Cursor-based message history with infinite scroll


## Architecture
### Project Structure
```
Chat Project/                   <= monorepo root
├── backend/                    <= NestJS application
│   └── src/
│       ├── ai/                 <= Gemini AI (AiService, AiRoomService)
│       │   ├── constants/      <= system-prompts.ts, AI_USER_EMAIL
│       │   └── enums/          <= ai-personality.enum.ts
│       ├── auth/               <= JWT auth, guards, strategies
│       │   ├── decorator/
│       │   ├── dto/
│       │   ├── guard/          <= JwtAuthGuard, RbacGuard, GraphqlAuthGuard
│       │   ├── interface/      <= Payload (JWT payload shape)
│       │   ├── role/
│       │   └── strategy/       <= passport-local, passport-jwt
│       ├── base/
│       │   ├── entity/         <= EntityBase (created/updated timestamps)
│       │   └── logger/         <= winston logger
│       ├── chat/               <= ChatGateway, ChatService, ChatResolver
│       │   ├── decorator/      <= gql-query-runner.decorator
│       │   ├── entities/       <= ChatEntity, RoomEntity
│       │   │   └── dto/        <= CreateChatDto
│       │   ├── guard/          <= RateLimitGuard
│       │   └── interceptor/    <= GqlTransactionInterceptor
│       ├── graphql/            <= PubSubService, GraphQL input/return types
│       ├── migrations/         <= TypeORM migration files
│       ├── mocks/              <= bcrypt mock for tests
│       ├── redis/              <= RedisModule, SessionCacheService
│       │   └── interface/      <= CachableMessage (shared with graphql/pubsub.service.ts)
│       └── user/               <= UserController, UserService, UserEntity
│           ├── dto/
│           └── entities/
└── frontend/                   <= React + Vite application
    └── src/
        ├── api/                <= apollo.ts, axios.ts, graphql-operations.ts
        ├── components/         <= ProtectedRoute
        ├── pages/              <= ChatPage, SigninPage, RegisterPage
        ├── socket/             <= socket.ts (Socket.IO singleton)
        ├── store/              <= auth.store.ts (Zustand)
        └── types/
```

### Hybrid Storage Pattern
- Redis(session/cache): It stores `userId` => `socketId` mapping for consistent data flow and shareable servers
- In-Memory(socket): It stores `socketId` => `Socket` objects which requires WebSocket operation which is easy implement and able to communicate in real-time
- Reason for utilizing both: Redis holds serialized objects as 'JSON' format, while socket holds as long as client is connected via TCP-level connection. Therefore, clients are enabled to reconnect with their session/cache data.

### Redis Pub/Sub
- `RedisPubSub` singleton (`pubsub.service.ts`): bridges GraphQL mutations to active subscriptions. After commit the resolver publishes to a `receiveMessage :${roomId}` channel; all connected `receiveMessage` subscribers receive the message in real time.

### Entities (TypeORM)
```
UserEntity
  id          PK
  email       unique
  password    excluded from API responses
  isAI        boolean (true only for the seeded AI system account)
  role        enum: user (0) | admin (1) | superadmin (2)
  chats    =< ChatEntity   (OneToMany)
  rooms    >< RoomEntity   (ManyToMany, join table on RoomEntity side)

ChatEntity
  id          PK
  message     string
  participant >= UserEntity  (ManyToOne — sender)
  room        >= RoomEntity  (ManyToOne)

RoomEntity
  id            PK
  aiPersonality nullable string (active AI personality for this room)
  participants >< UserEntity   (ManyToMany owner, @JoinTable)
  chats        =< ChatEntity   (OneToMany)

EntityBase (inherited by all three)
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
  3.3. AI reply saved to DB, cached in Redis via `SessionCacheService.cacheMessage()`, published to
       Pub/Sub through the same `receiveMessage :${roomId}` channel as human messages

4. Subscriber receives message
  4.1. Redis Pub/Sub delivers to all active `receiveMessage(roomId)` subscribers
  4.2. GraphQL subscription resolves and pushes payload to client


## Build
### Total Installation
Dependencies (35)
- @apollo/server
- @as-integrations/express5
- @google/genai
- @nestjs/apollo
- @nestjs/config
- @nestjs/graphql
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/passport
- @nestjs/platform-socket.io
- @nestjs/swagger
- @nestjs/typeorm
- @nestjs/websockets
- @types/bcrypt
- @types/passport-jwt
- @types/passport-local
- bcrypt
- class-transformer
- class-validator
- graphql
- graphql-redis-subscriptions
- graphql-subscriptions
- graphql-ws
- ioredis
- joi
- nest-winston
- passport
- passport-jwt
- passport-local
- pg
- redis
- socket.io
- socket.io-client
- typeorm
- winston

DevDependencies (5)
- @types/supertest
- @types/winston
- supertest
- ts-jest (custom jest config)
- source-map-support

Excluded NestJS CLI defaults like common, core, platform-express, testing, jest, eslint, prettier, ts-node, typescript, etc.


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
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().required(),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
        HASH_ROUNDS: Joi.number().required(),
        REFRESH_TOKEN_SECRET: Joi.string().required(),
        ACCESS_TOKEN_SECRET: Joi.string().required(),
        REFRESH_TOKEN_SECRET_EXPIRES_IN: Joi.number().required(),
        ACCESS_TOKEN_SECRET_EXPIRES_IN: Joi.number().required(),
        CORS_ORIGIN: Joi.string().required(),
        GEMINI_API_KEY: Joi.string().required(),
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


### Chat
Websocket
  A real-time, bidirectional communication protocol, connects between a web browser(clients) and server.
  It creates persistent connections for instant data exchange, replacing slow HTTP polling for dynamic, low-latency experiences.

Lifecycle Hooks
- OnGatewayConnection
  Forces to implement the handleConnection() method. Takes library-specific client socket instance as an argument.
- OnGatewayDisconnect
  Forces to implement the handleDisconnect() method. Takes library-specific client socket instance as an argument.


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
Start Redis
`docker start redis-chat`

Stop Redis
`docker stop redis-chat`

Remove container (keeps image)
`docker rm redis-chat`


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
- `MAX_ADMIN_COUNT` env var (default: 5) limits the number of `admin`-role accounts. Superadmin accounts are not counted toward this limit.


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


### Redis
- Supposedly, A data stored in-memory Socket with without Redis, however with Redis, it can efficiently store user's metadata, and useful when horizontal scale up the server.

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
- The complete AI reply is delivered as a single message via WebSocket broadcast and GraphQL Pub/Sub

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
  "ai-personality.enum.ts"
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
- Test Suites: 6 passed, 6 total (auth, chat, user, redis, ai, ai-room)

**Coverage Results**
- Auth Service: 89.02%
- Chat Service: 94.44%
- Redis Service: 100%
- User Service: 73.17% (excluded simple 'Get' and 'Delete' methods)
- AI Service: 100%
- AI Room Service: 100%

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
`git push origin main` => GitHub Actions (test => build) => Railway CLI => Auto-deploy

**Setup (one-time)**
1. Add `RAILWAY_TOKEN` in GitHub => Settings => Secrets => Actions
2. Set `.env` variables in Railway Dashboard => Variables tab
3. Add Redis plugin in Railway (replaces local Docker Redis)

**Config Files**
- '.github/workflows/deploy.yml' runs test & build, then deploys via Railway CLI
- 'railway.toml' builds with Dockerfile, runs `cd backend && pnpm migration:run && node dist/main` on deploy


#### Local - Docker
Using Docker to deploy and run Redis server

- Run Redis Container
`docker run -d -p 6379:6379 --name redis-chat redis:latest`

- Show 'redis-chat' container
`docker ps`

- Verify Redis Connection
`docker exec -it redis-chat redis-cli ping` => PONG


#### Usage
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


## Scale Up In Future
- Backend: Store conversation list per user (last message, unread message count, etc)
- Backend: Group chat rooms (broadcast via `roomId` to multiple participants)
- Backend: Let users delete rooms and conversation history
- Backend: "User is typing" indicator via Socket.IO event
- Frontend: Chat room list UI with unread message count


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