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

# Real-Time Chat Application
- An classical private One-to-One chatting server-side management application that validated users can chat with the other user.
- This project is for understanding how socket.io can make two entities communicate each other, caching and rate-limiting with Redis, persistent session, and save their chat logs in server.


## Overview
A casual private One-to-One chatting project that enables communication real-time.
- Authentication: JWT-based auth with Passport strategies
- Chat Management: Socket and Redis session & cache connection with transaction safety
- API Documentation: Swagger integration + Altair & GraphQL
- Testing: Unit tests with approximate +70% coverage on core logic


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
  Edit file name as '.env' and change with your DB credentials.
  ```powershell
  cp .env.example
  ```
 
  # Create database manually
  Set 'synchronize: true' in 'app.module.ts' for automatic DB creation.

  # Migration Schema Set Up
  Set 'synchronize: false' in 'app.module.ts' for DB migration to record schema any changes.
  ```powershell
  ⬇ migration:generate
  ⬇ pnpm build 
  ⬇ pnpm migration:run
  ```

  # Run Redis in Docker
  ```powershell
  docker start redis-chat
  ```

  # Run development
  ```powershell
  pnpm run start:dev
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

  # Run test coverage
  pnpm run test:cov
  
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
    - ✅ Take a look in files where to save messages such as 'service' or 'resolver' whether transaction elements: `commitTransaction()`, `rollbackTransaction()`, `release()` are implemented.


## API Documentation
### Swagger UI
***To try all of'em, you must register first to get started.***
Since Altair cannot test with Mutation, while Postman cannot test Subscription, each platforms take a role as Subscription and Mutation separately to test chat communication altogether.

### Key Endpoints
**Swagger**
Test 'Auth' and 'User' Endpoints URL below.
- URL: `http://localhost:3000/doc`

**Authentication**
- `POST /auth/register` - Register with Basic Auth
- `POST /auth/signin` - Get JWT tokens
- `POST /auth/token/refreshaccess` - Refresh access token

**User**
- `GET /user` - Get all users
- `GET /user/:id` - Get a user 
- `POST /user` - Create a user
- `PATCH /user/:id` - Update a user
- `PATCH /user/:id` - Delete a user

**Chat**
- Socket.IO
  ***Tap 1***
  - URL: `ws://localhost:3000`
  - Description: Open two Socket.IO taps on 'Postman' and send message through it.
  - Request Handlers
    - Default Request Handler: Socket.IO
    - Headers
      - key : authorization; value: Bearer token
    - Events: SendMessage(Listen: ON), CreateRoom(Listen: ON)
  - Message
    ```json
    {
      "message": "Message from Participant 1 to 2",
      "recipientId": 2
    }
    ```

  ***Tap 2***
  - URL: `ws://localhost:3000`
  - Description: Open two Socket.IO taps on 'Postman' and send message through it.
  - Request Handlers
    - Default Request Handler: Socket.IO
    - Headers
      - key : authorization; value: Bearer token
    - Events: SendMessage(Listen: ON), CreateRoom(Listen: ON)
  - Message
    ```json
    {
      "message": "Message from Participant 2 to 1",
      "recipientId": 1
    }
    ```


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
- Rate limiting - 10 messages per minute/user
- Persistent user sessions across server restarts
- Private chat rooms between users
- Transaction-safe message storage & delivery
- Horizontal scaling ready - Redis-backed session
- AI chat powered by Google Gemini 2.5 Flash (4 personalities: Friendly, Coding, English, Creative)
- Cursor-based message history with infinite scroll


## Architecture
### Hybrid Storage Pattern
- Redis(session/cache): It stores `userId` => `socketId` mapping for consistent data flow and shareable servers
- In-Memory(socket): It stores `userId` => `socketId` objects which requires WebSocket operation which is easy implement and able to communicate in real-time
- Reason for utilizing both: Redis holds serialized objects as 'JSON' format, while socket holds as long as client is connected via TCP-level connection. Therefore, clients are enabled to reconnect with their session/cache data.

### Redis Pub/Sub
- `RedisPubSub` singleton (`pubsub.service.ts`): bridges GraphQL mutations to active subscriptions. After commit the resolver publishes to a `receiveMessage :${roomId}` channel; all connected `receiveMessage` subscribers receive the message in real time.


## Flow
The frontend uses the **GraphQL Mutation Path** for sending messages; the **Socket.IO Path** remains available for direct WebSocket clients.

### Socket.IO Path
1. Client connects WebSocket with handleConnection in `chat.gateway`
  1.1. Authenticate JWT token
  2.2. Store `userId` => `socketId` in Redis
  2.3. Store `socketId` => Socket in Map
  2.4. `joinRooms()` users to join in the existing rooms

2. Client calls `sendMessage` function
  2.1. RateLimitGuard: Redis increment user: `${userId}`
  2.2. Condition: `count > 10? Throw 'WsException' : Continue`
  2.3. Set TTL for 60s if first message per user

3. Process of `sendMessage`
  3.1. Execute `sendMessage`
  3.2. Start QueryRunner transaction
  3.3. Validate sender and recipient existence
  3.4. Execute `findRoom` or `createRoom`
  3.5. Save 'ChatEntity' to DB with room foreign key
  3.6. Commit transaction in rollback if errors

4. Retrieve sender Socket
  4.1. Redis: `getUserStatus` gets `socketId`
  4.2. Map: `clientConnection.get(getUserSocketId.socketId)` gets Socket object`

5. Emit to Socket.io room
  5.1. `senderSocketId.to(room.id.toString())`, then `emit('sendMessage')` to `(ChatEntity, messageSchema)`, broadcasts to room members through `room.id`
  5.2. `senderSocketId.emit('sendMessage')` confirms delivery to sender in `(ChatEntity, messageSchema)`

6. Recipient receives Sender's message
  6.1. `joinRooms()` already made users to join the existing rooms
  6.2. Client receives 'SendMessage' with message schema

7. Client Disconnects
  7.1 Clients performs `handleDisconnect()` to disconnect from socket in `chat.gateway`
  7.2 Clients disconnects from Redis => status: offline
  7.3 When clients disconnects, the `removeClient` performs `Map` to delete `socketId` entry in `chat.service`

### GraphQL Mutation Path
1. Client calls `sendMessage` mutation
  1.1. `GraphQLAuthGuard` + `RateLimitGuard` run
  1.2. Inline `QueryRunner` opens and starts a transaction
  1.3. `ChatService.sendMessage()` validates sender/recipient, finds or creates room, saves `ChatEntity`
  1.4. `queryRunner.commitTransaction()`

2. Post-commit delivery
  2.1. `SessionCacheService.cacheMessage()` stores message in Redis
  2.2. `PubSubService.publish()` pushes to `receiveMessage :${roomId}` channel
  2.3. `ChatService.broadcastToRoom()` emits `'sendMessage'` to Socket.IO room

3. AI reply (if recipient is AI user)
  3.1. `setImmediate` fires after response returns
  3.2. `AiService.handleReply()` acquires Redis lock, builds conversation history, calls Gemini API
  3.3. AI reply saved to DB, cached in Redis, broadcast to room, published to Pub/Sub

4. Subscriber receives message
  4.1. Redis Pub/Sub delivers to all active `receiveMessage(roomId)` subscribers
  4.2. GraphQL subscription resolves and pushes payload to client


## Build
### Total Installation
Dependencies (36)
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
- @nestjs/throttler
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
Once installation is finished, go to `app.module`, and set up configuration of the package.

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
Create a `.env` file in the root directory and paste variables below :
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
`docker exec -it redis-chat redis-cli ping`


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
- When users issue bearer token, they need a raw token. Once their roles are set as `signedIn`, they can have the raw token that contains their role information.
- The users only who have `signedIn` can send messages even if token is issued for them.
- It throws error when user's role is `signedOut` as following log.


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
  "resolver.ts"
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
- Auth Service: 95.89%
- Chat Service: 91.86%
- Redis Service: 90.9%
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
          mockQueryRunner as QueryRunner,
        );

        expect(chatService.findRoom).toHaveBeenCalledWith(
          mockSender.id,
          mockRecipient.id,
          mockQueryRunner as QueryRunner,
        );
        expect(result).toEqual(mockRooms);
      });
    }
  });
```


### Deployment
#### Frontend - Vercel
**Live Demo**
- Live URL: https://chat-sage-phi.vercel.app

**CI/CD Flow**
`git push origin main` => Vercel Auto-deploy

**Config**
- Root Directory: `frontend/`
- `pnpm-workspace.yaml` for monorepo package resolution


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
- 'railway.toml' builds with Dockerfile, runs `pnpm migration:run && pnpm run start:prod` on deploy


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
- Backend: Store conversation list per user (last message, unread message, etc)
- Backend: Broadcast via `roomId` to scale to create group chats, or notification with `Redis Pub/Sub` package
- Backend: Let users delete rooms and conversation
- Backend: Let users see "User is typing" when one side is typing a message
- Frontend: httpOnly Cookie for refreshToken security hardening
- Frontend: Apollo Client token refresh on WebSocket reconnection
- Frontend: Chat room list UI with unread message count