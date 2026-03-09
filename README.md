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
  Set 'synchronize: true' in 'app.module.ts' for automatic DB development

  # 4. Run development
  pnpm run start:dev
  
  # 5. Open Altair and Postman
  Follow the steps in API Documentation, Key Endpoints, **Chat** section below

  # 5. Run all tests
  pnpm test

  # 6. Run test coverage
  pnpm run test:cov
  
  # 7. Access Swagger UI
  http://localhost:3000/doc
```

### Error Solution
List of error solutions when the program runs
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
- WebSocket
  - URL: `ws://localhost:3000`
  - Description: Open two WebSocket taps in 'Postman' and send message through it.

- Altair (alternative)
  - URL: POST `http://localhost:3000/graphql`
  - Description: This platform can be altered. Open a tap of in Altair, and set the request handlers as following, then connect to the GraphQL, if succeed you are able to test messaging communication when send messages from GraphQL as receiver.

  - Request Handlers
    - Default Request Handler: HTTP
    - Parameters (in JSON): {}
    - Subscription URL: http://localhost:3000/graphql
    -  Use default request handler for subscription: off
    - Subscription type: WebSocket (graphql-ws)
    - Connection Parameters (in JSON): { "authorization": "Bearer token" }
  - Query
    ```altair
    subscription {
      messageAdded(roomId: "19") {   
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

- GraphQL
  - URL: `http://localhost:3000/graphql`
  - Description: This platform cannot be altered. Open a tap of GraphQL in 'Postman', and set the pre-requisition as following, then connect to the Altair. If this all set, you are ready to test messaging communication as sender.

  - Request Handlers
    - Headers: authorization: Bearer token
  - Query
    ```graphql
    mutation SendMessage($input: CreateChatInput!) {
        sendMessage(input: $input, recipientId: 2) {
            id
            message
            participant {
                id
                email
                password
                role
            }
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
      }
    }
    ```


## Stacks
- Language: Typescript, a type-safe and a solid object oriented language, superset of Javascript. ✔
- Backend: Node.Js, this javascript runtime built with chrome V8 engine, provides ecosystem where the applications run smoothly. ✔
- Framework: Nest.Js, a scalable framework for Typescript project, and a powerful framework that is keep rising. ✔
- Architecture: Monolithic Architecture, a principle for casual-fitting project and easy to couple and decouple unit of components. ✔
- Socket: Socket.IO, as written Nestjs official documentation, this middleware package provides method how to handle format as multipart/form-data, through HTTP request by Post method, which make the application easy to handle. ✔
- Authentication: JWT Authentication; authenticate user validation for using the application
- Guard: allow validated only types of data ✔
- Interceptor: a middleware to manipulate user's data ✔
- Role Based Access: differ levels of user by authorization class 
- Chat: major websocket implementation ✔
- Cache: Redis for message rate-limit and store user's data efficiently. ✔
- Filter: exception handlers ✔
- Logger: records events, error, debug infos while executing the application ✔
- Unit Test: Testing service methods by each unit
<!-- - Prisma:  -->
- Swagger: Documenting by methods to test each of endpoints


## Features
- Real-time bidirectional messaging
- Rate limiting - 10 messages per minute/user
- Persistent user sessions across server restarts
- Private chat rooms between users
- Transaction-safe message storage & delivery
- Horizontal scaling ready - Redis-backed session


## Architecture
### Hybrid Storage Pattern
- Redis(session/cache): It stores `userId` => `socketId` mapping for consistent data flow and shareable servers
- In-Memory(socket): It stores `userId` => `socketId` objects which requires WebSocket operation which is easy implement and able to communicate in real-time
- Reason for utilizing both: Redis holds serialized objects as 'JSON' format, while socket holds as long as client is connected via TCP-level connection. Therefore, clients are enabled to reconnect with their session/cache data.


## Flow
1. Client connects WebSocket with handleConnection in `chat.gateway`
  1.1. Authenticate JWT token
  2.2. Store userId => socketId in Redis
  2.3. Store socketId => Socket in Map
  2.4. Join user to existing rooms

2. Client calls `sendMessage` function
  2.1. RateLimitGuard: Redis INCR user: ${userId}
  2.2. Condition: `count > 10? Throw 'WsException' : Continue`
  2.3. Set TTL for 60s if first message per user

3. Process of `sendMessage`
  3.1. Start QueryRunner transaction
  3.2. Validate sender and recipient existence
  3.3. Execute `findRoom` or `createRoom`
  3.4. Save ChatEntity to DB with room foreign key
  3.5. Commit transaction in rollback if errors

4. Retrieve sender Socket
  4.1. Redis: `getUserStatus` gets `socketId`
  4.2. Map: `clientConnection.get(getUserSocketId.socketId)` gets Socket object`

5. Emit to Socket.io room
  5.1. `senderSocketId.to(room.id.toString())`, then `emit("SendMessage")` to `(ChatEntity, messageSchema)`, broadcasts to all in room through  `room.id`
  5.2. `senderSocketId.emit("SendMessage")` confirms delivery to sender in `(ChatEntity, messageSchema)`
  <!-- 5.3. Redis sends  -->

6. Recipient receives Sender's message
  6.1. Client receives 'SendMessage' with message schema
  6.2. 

7. Client Disconnects
  7.1 Clients disconnects from socket in `chat.gateway`


? RateLimitGuard checks Redis counter
? ChatService finds/creates room
? Save to PostgreSQL
? Emit to Socket.IO room
? Broadcast to recipient
? Client sends message

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


### Auth
Implementation of two ways of sign-in endpoints.
- Basic Authentication
  - The clients need to submit username and password, encoded by 'base64', which converts binary data into plain text to transmit safely, to verify credentials.
- Token-based Authentication
  - When the clients logs in, they can get token formed as JWT(Javascript Web Token), then server sends token on subsequent requests, which is authenticated, instead of your credentials in Basic Authentication, so the server validates the token


### Role
- When users issue bearer token, they need a raw token. Once their roles are set as `signedIn`, they can have the raw token that contains their role information.
- The users only who have `signedIn` can send messages even if token is issued for them.
- It throws error when user's role is `signedOut` as following log.


### Redis
- Supposedly, A data stored in-memory Socket with without Redis, however with Redis, it can efficiently store user's metadata, and useful when horizontal scale up the server.


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


<!-- - Terminal Log -->
<!-- LOG [WebSocketsController] ChatGateway subscribed to the "send" message -->
<!-- LOG [WebSocketsController] ChatGateway subscribed to the "receive" message -->

<!-- - Postman Log
```
``` -->


#### Check User Data

- Terminal command
`docker exec -it redis-chat redis-cli`

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
- Store conversation list per user (last message, unread message, etc)
- Return `roomId` to frontend instead of recalculating(mid of queries) it
- Use `roomId` to scale to group chats later
- Let users delete rooms and conversation
- Restore by load up previous chat logs when user disconnected from Socket
- Let users see "User is typing" when one side is typing a message