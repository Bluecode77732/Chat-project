# Real-Time Chat Application
- An classical private One-to-One chatting server-side management application that validated users can chat with the other user.
- This project is for understanding how socket.io can make two entities communicate each other, caching and rate-limiting with Redis, persistent session, and save their chat logs in server.

## Quick Start
- Prerequisites
  - Node.js >= v18.xx
  - Nest.js >= v11.xx
  - PostgreSQL >= v14.xx
  - pnpm (recommended) or npm
  - Docker >= v28.xx

```powershell
  # Install dependencies
  pnpm install
  
  # Setup environment
  # **Edit with your DB credentials**
  cp .env
 
  # 3. Create database manually (no migrations in package.json)
  Set 'synchronize: true' in 'app.module.ts' for development
  
  # 4. Run development
  pnpm run start:dev

  # 4. Run all tests
  pnpm test

  # 4. Run test coverage
  pnpm run test:cov
  
  # 5. Access Swagger UI
  http://localhost:3000/doc
```

## API Documentation
### Swagger UI
***To try all of'em, you must register first to get started.***

### Key Endpoints
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
- `ws://localhost:3000` - Send message through WebSocket
- `http://localhost:3000/graphql` - Test communication through GraphQL


## Stacks
- Language: `Typescript`, a type-safe and a solid object oriented language, superset of Javascript. ✔
- Backend: `Node.Js`, this javascript runtime built with chrome V8 engine, provides ecosystem where the applications run smoothly. ✔
- Framework: `Nest.Js`, a scalable framework for Typescript project, and a powerful framework that is keep rising. ✔
- Architecture:  `Monolithic Architecture`, a principle for casual-fitting project and easy to couple and decouple unit of components. ✔
- Cache: `Socket.io`, as written Nestjs official documentation, this middleware package provides method how to handle format as multipart/form-data, through HTTP request by Post method, which make the application easy to handle. ✔
- Authentication: JWT Authentication; authenticate user validation for using the application
- Guard: allow validated only types of data ✔
- Interceptor: a middleware to manipulate user's data ✔
- Pipe: 
- Role Based Access: differ levels of user by authorization class 
- Chat: major websocket implementation ✔
- Filter: exception handlers ✔
- Logger: records events, error, debug infos while executing the application ✔
- Unit Test: Testing service methods by each unit
- Cache: `Redis` for message rate-limit and store user's data efficiently. ✔
- Prisma: 
- Swagger: 

## Features
- Real-time bidirectional messaging
- Rate limiting - 10 messages per minute/user
- Persistent user sessions across server restarts
- Private chat rooms between users
- Transaction-safe message storage & delivery
- Horizontal scaling ready - Redis-backed session

## Flow
### Chat
1. Validate users
2. Join Users
3. Find room/Create room
4. Send message
5. Save message
6. Broadcast to sockets

### Auth
Client connects WebSocket (Chat.gateway: handleConnection)
Client calls 'sendMessage' event
Retrieves sender Socket
Emit to Socket.io room
Recipient receives Sender's message
Client Disconnects

RateLimitGuard checks Redis counter
ChatService finds/creates room
Save to PostgreSQL
Emit to Socket.IO room
Broadcast to recipient
Client sends message

1. registerClient
2. removeClient
3. joinRooms
4. findRoom
5. createRoom
6. getOrCreateRoom
7. sendMessage


## Build
### Chat
Websocket
  A real-time, bidirectional communication protocol, connects between a web browser(clients) and server.
  It creates persistent connections for instant data exchange, replacing slow HTTP polling for dynamic, low-latency experiences.

Lifecycle Hooks
- OnGatewayConnection
  Forces to implement the handleConnection() method. Takes library-specific client socket instance as an argument.
- OnGatewayDisconnect
  Forces to implement the handleDisconnect() method. Takes library-specific client socket instance as an argument.


### Redis
Supposedly, A data stored in-memory Socket with without Redis, however with Redis, it can efficiently store user's metadata, and useful when horizontal scale up the server.


#### Compare Sample Code 
Socket In memory
```ts
  @Injectable()
  export class ChatService {
    // Maps authenticated userId to get their current Socket instance (1-to-1)
    private readonly clientConnection = new Map<number, Socket>();

    // TypeORM repositories for Room and User with DataSource
    constructor(
        // Injecting redisService to replace current in-memory storage Socket instance
        private readonly redisService: SessionCacheService,
    ) { };

    registerClient(participantId: number, client: Socket) {
      this.clientConnection.set(participantId, client);
    };

    // Disconnect Socket
    removeClient(participantId: number) {
      this.clientConnection.delete(participantId);
    };
  }
```

Redis memory
```ts
  @Injectable()
  export class ChatService {
    // Maps authenticated userId to get their current Socket instance (1-to-1)
    private readonly clientConnection = new Map<number, Socket>();
  
    // TypeORM repositories for Room and User with DataSource
    constructor(
        // Injecting redisService to replace current in-memory storage Socket instance
        private readonly redisService: SessionCacheService,
    ) { };

    // Connect Socket
    async registerClient(participantId: number, client: Socket) {
        await this.redisService.sethUserOnline(participantId, client.id);
        this.clientConnection.set(client.id, client);
    };

    // Disconnect Socket
    async removeClient(participantId: number, client: Socket) {
        await this.redisService.sethUserOffline(participantId);
        this.clientConnection.delete(client.id);
    };
  }
```

### Check User Data

- Terminal command
`docker exec -it redis-chat redis-cli`

- Check keys
`KEYS user:*`

- Check data
`HGETALL user:<user_number>`

Result:
`HGETALL user:1`
1) "socketId"
2) "5Ktdy8PO-CbS2sa4AAAD"
3) "status"
4) "online"

`HGETALL user:2`
1) "socketId"
2) "fFyW-wbprFGKtBfkAAAB"
3) "status"
4) "online"


### Docker
#### Build
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



- Terminal Log
<!-- LOG [WebSocketsController] ChatGateway subscribed to the "send" message -->
<!-- LOG [WebSocketsController] ChatGateway subscribed to the "receive" message -->

- Postman Log
```
```


## Debug
- Incorrect queries in TypeORM
- Missing `commitTransaction()` to messages will appear in DB
- Creating new rooms repeatedly when send message each time
- Sending wrong recipient ID from frontend


## Scale Up In Future
- Store conversation list per user (last message, unread message, etc)
- Return `roomId` to frontend instead of recalculating(mid of queries) it
- Let frontend send messages to `roomId` instead of to recipientId
- Use `roomId` to scale to group chats later
- Let users delete rooms and conversation
