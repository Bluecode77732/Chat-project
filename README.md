# Chat Project
- An classical private One-to-One chatting server-side management that validated users to chat between the other user.
- This project is for understanding how using socket.io can make two entities communicate each other and save their chat logs in server.

## Quick Start
- Prerequisites
  - Node.js >= 18.x
  - PostgreSQL >= 14.x
  - pnpm (recommended) or npm

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

## Stacks
- `Monolithic Architecture`, a principle for casual-fitting project and easy to couple and decouple unit of components.
- `Socket.io`, as written Nestjs official documentation, this middleware package provides method how to handle format as multipart/form-data, through HTTP request by Post method, which make the application easy to handle.
- `Node.Js`, this javascript runtime built with chrome V8 engine, provides ecosystem where the applications run smoothly.
- `Nest.Js`, a scalable framework for Typescript project, and a powerful framework that is keep rising.
- `Typescript`, a type-safe and a solid object oriented language, superset of Javascript.


## Implementation
- guard: allow validated only types of data ✔
- interceptor: a middleware to manipulate user's data ✔
- pipe: 
- JWT Authentication: authenticate user validation for using the application
- Role Based Access: differ levels of user by authorization class 
- Chat: major websocket implementation ✔
- filter: exception handlers ✔
- Logger: records events, error, debug infos while executing the application
- Test: 
- Cache: 
- Prisma: 
- Swagger: 


## Chat
Websocket
  A real-time, bidirectional communication protocol, connects between a web browser(clients) and server.
  It creates persistent connections for instant data exchange, replacing slow HTTP polling for dynamic, low-latency experiences.

Lifecycle Hooks
- OnGatewayConnection
  Forces to implement the handleConnection() method. Takes library-specific client socket instance as an argument.
- OnGatewayDisconnect
  Forces to implement the handleDisconnect() method. Takes library-specific client socket instance as an argument.

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
