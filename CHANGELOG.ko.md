# 변경 이력 (Changelog)

이 프로젝트의 전체 히스토리를 `git log`에서 그대로 재구성한 문서입니다 — 모든 커밋을 날짜별로
묶어(최신 순) 나열합니다. 아직 semantic versioning을 쓰지 않으므로(이 시점 기준 git 태그 없음),
릴리스 버전이 아니라 날짜로 그룹화했습니다.

커밋 메시지는 작성된 그대로 재현했습니다 — 초기 개발 단계의 표기 불일치나 비정형적인 문구도
포함됩니다(새 커밋이 따라야 할 컨벤션은 [CONTRIBUTING.ko.md](CONTRIBUTING.ko.md#커밋-컨벤션) 참고).
아래 내용은 다듬거나 정리하거나 생략한 것이 하나도 없습니다. 커밋 메시지 원문은 (한국어/영어 여부와
무관하게) 번역하지 않고 그대로 실었습니다 — 실제로 쓰이지 않은 말을 지어내는 것이 되기 때문입니다.


## 2026-07-16

- Fix: suppress dotenv's random tip line from migration CLI output
- Docs: document admin GraphQL ops/role-change email, refresh test coverage table

## 2026-07-15

- Harden: enable noFallthroughCasesInSwitch in backend tsconfig
- Refactor: type UserEntity.role as UserRole, drop enum-comparison suppressions
- Docs: overhaul README.md/README.ko.md, add MIT LICENSE
- Fix: admin e2e loginAsSuperadmin navigate to /users after landing on dashboard
- Fix: scope admin vitest to src so it skips Playwright e2e specs
- Test: raise mail/chat/auth/redis/user service coverage to 90%+

## 2026-07-14

- Fix: audit log pagination freezing on a failed page fetch
- Fix: prevent deleting the AI/moderation system service accounts
- Test: lock moderation escalation boundaries and key naming
- Remove: admin AI personality override feature
- Sync: regenerate schema.gql for admin AI personality resolvers
- Add: Audit log CSV export
- Docs: add manual E2E verification checklist for moderation
- Docs: document optional MODERATION_* env knobs in .env.example

## 2026-07-13

- Fix: exclude AI/system service accounts from dashboard Total Users count
- Add: migration cascade guard spec + README fire-point flow
- Docs: require infra inspection before proposing new tooling
- Fix: guard myRole null before role-privilege comparisons in users-page
- Docs: update audit-log Swagger description with the 3 new action types
- Fix: audit log action whitelist gap + add manual user ban
- Add: Users status filter, Room detail panel, Logs date range filter
- Docs: flag the ManyToMany FK revert in migration:generate

## 2026-07-12

- Logging: add warn/info for rate-limit exceed and role change success
- Harden: enable full strict mode in backend tsconfig
- Add: Unban button in user panel + Dashboard online users and nicknames
- Docs: fix single-test command for Jest 30 (--testPathPatterns)
- Add: AI Room personality management in admin panel
- Add: User detail panel on Users page
- Logging: add warn entries to jwt.strategy and auth.service for security events
- Add: Logs page user filter (actor/target search)
- Logging: add structured logger entries across moderation, pubsub, mail, and bootstrap
- Docs: add self-compliance verification steps to CLAUDE.md
- Docs: document behavioral moderation in README
- Test: raise ModerationService branch coverage to 86%
- Test: e2e spec for moderation escalation (warning + mute)
- Update: sync schema.gql with getAllRooms search arg
- Add: AddModerationColumns migration (user_entity status/bannedUntil)
- Update: pin Node engine to 24.x and add Corepack integrity hash

## 2026-07-11

- Update: trigger CI on PRs with cross-OS matrix and guard deploy to main
- Docs: add docker rebuild reminder and README update rule to CLAUDE.md
- Add: Dashboard page with user/room stats and recent audit logs
- Add: moderation frontend UX + ban gate on token refresh
- Add: wire moderation into sendMessage, auth, socket, and admin unban
- Add: behavioral moderation core module (strike accrual + escalation)
- Add: Rooms search by participant email/nickname

## 2026-07-09

- Docs: enrich Swagger/OpenAPI docs and fix UpdateUserDto body schema
- Test: add E2E coverage for Users page search (nickname + email + clear)
- Add: Created column/sort for Users & Rooms, Users search, sort indicator

## 2026-07-08

- Add: role sort to admin Users page
- Feat: admin panel — pagination/sort for users & rooms, audit log time sort, superadmin protection
- Docs: soften getByText prohibition to a project convention
- Docs: add Playwright e2e selector meta-principles to CLAUDE.md
- Fix: logger — add debug to signOut silent catch in auth controller
- CI: run admin e2e tests against a fresh Postgres/Redis, seeded with a superadmin
- Add: Playwright e2e tests for admin's user/room management and audit log
- Fix: let superadmin act on other users' accounts, not just admin

## 2026-07-07

- Add: account page e2e coverage; fix misleading AI personality-change copy
- Fix: cast through unknown for private aiUser access in ai.service.spec
- Chore: untrack frontend tsbuildinfo (already gitignored)
- Update: standardize toolchain and enforce cross-OS consistency
- Add: e2e coverage for AI chat, rate limiting, and forced session logout
- Fix: type AiRoomEntity.room as optional to reflect its load state

## 2026-07-06

- Harden: require REDIS_URL in Joi and enable stricter tsconfig checks
- Chore: untrack .claude/settings.local.json and add to .gitignore
- Fix: standardize catch-block error logging to instanceof Error pattern
- Add: Playwright e2e CI job with Postgres/Redis service containers
- Docs: correct CLAUDE.md cache invalidation claim for user_cache
- Fix: remove non-null assertions, empty catches, and floating promises across backend

## 2026-07-05

- Add: Playwright e2e tests for register/sign-in, real-time chat, and sign-out
- Fix: define missing ChatService.notifyRoomParticipants
- Docs: trim over-specified CLAUDE.md rules; move sendMessage non-idempotency to code comment
- Docs: add caching flow description and design concept principles to CLAUDE.md
- Docs: add a11y, i18n, UX, privacy, cost, SBOM, backup principles to CLAUDE.md

## 2026-07-04

- Docs: correct caching flow description and add cache-corruption case study
- Fix: stop double-caching AI replies to prevent corrupted created timestamps
- Docs: add incident-response principles to CLAUDE.md and AI dev case study to README

## 2026-07-03

- Add: fallback notice message when AI reply generation fails after retries
- Add: retry Gemini API calls on transient failures in AI reply generation
- Docs: tie interface/type placement rule back to its generic principle
- Docs: extend interface-placement rule to type aliases and spec-only consumers
- Docs: fix stale redis-subscriber.service.ts references in CLAUDE.md
- CI: add admin lint + test steps to deploy.yml
- Docs: add interface-placement convention; fix stale README structure trees
- Refactor: extract CachableMessage into redis/interface/ folder
- Docs: fix stale getOrCreateRoom test example (QueryRunner -> EntityManager)
- Fix: use OnApplicationShutdown instead of OnModuleDestroy for ChatGateway's Redis adapter cleanup
- Fix: enable graceful shutdown hooks so OnModuleDestroy runs on SIGTERM
- Docs: sync CLAUDE.md + README.md with current implementation
- Fix: updateRole TOCTOU race + sethUserOffline TTL gap
- Docs: fix stale QueryRunnerDecorator/WsTransactionInterceptor references; add GqlTransactionInterceptor regression test

## 2026-07-02

- Add: GraphQL transaction interceptor for sendMessage, replacing inline dataSource.transaction()

## 2026-07-01

- Remove: delete 4 orphaned transaction decorator/interceptor files superseded by inline DataSource pattern
- Refactor: apply SOLID fixes — DIP injection, EntityManager params, transaction wrappers
- Fix: extend EmptyStateNotice with layout props and replace inline JSX
- Fix: resolve pre-existing lint debt (113 errors → 0)
- Fix: extend blacklist check to WS connection path in parseBearerToken
- Docs: correct 3 entries in CLAUDE.md (B/C/D follow-up)

## 2026-06-30

- Docs: correct 4 stale entries in CLAUDE.md
- change: button context; chat-page.tsx
- UI: move empty-state notice below single-row banner with arrow pointing at badge area
- Fix: extend Socket.IO CORS to support comma-separated multi-origin env var
- Fix: replace GraphQLAdminGuard inheritance with guard composition to resolve LSP violation

## 2026-06-29

- Fix: repair broken backend e2e test and add graceful Redis shutdown
- Docs: document CORS multi-origin decision in CLAUDE.md
- Feat: add single-refresh-authority session guard to admin app
- Feat: support multiple CORS origins for frontend + admin dashboard
- Fix: resolve react-hooks/set-state-in-effect errors in chat-page.tsx
- Chore: remove unused /signin/local route, LocalAuthGuard and LocalStrategy
- Update: CLAUDE.md; add full engineering principles reference, conflict-resolution protocol, project-specific invariants, and file-creation header convention

## 2026-06-28

- Feat: show a once-per-day date divider above message groups in chat
- Feat: apply Hahmlet Korean font to match Chatterley's serif branding
- Feat: hide Conversations banner edge fade when there's nothing left to scroll

## 2026-06-27

- Feat: force-disconnect a superseded session's socket in real time on new login
- Fix: use getValues instead of watch in confirm-password validation
- Feat: add password confirmation and detect sessions superseded by another login
- Feat: add loading skeleton on room switch and auto-growing message textarea
- Feat: add bubble tail, redesign input area, and fix responsive overflow on chat page

## 2026-06-26

- Fix: raise body size limit for profile image uploads and show a friendly message on payload-too-large
- Chore: add migration for user.profileImage column and regenerate schema.gql
- Feat: add base64 profile image upload with avatar fallback to initials
- Fix: align avatar to message-group bottom and preserve nickname casing in initials
- Feat: group consecutive messages by sender with a shared circular initials avatar
- Fix: remove washed-out opacity on selected offline user, add scroll-fade gradient to Conversations banner
- Chore: gitignore .playwright-mcp verification artifacts
- Fix: replace header shadow-sm with border-b to avoid shadow bleed on sides/top
- Feat: switch Chatterley title font from Bodoni Moda to Cormorant Garamond
- Feat: apply self-hosted Bodoni Moda italic font to Chatterley title
- Feat: add header divider and rebrand title to "Chatterley" with gradient style

## 2026-06-25

- Refactor: extract empty-state chat notices into reusable EmptyStateNotice component
- Feat: add empty-state chat notices with dismiss and conversation search filter

## 2026-06-24

- Fix same duplicate-message bug for subscription-received messages: coerce ID to number
- Fix duplicate message rendering: coerce GraphQL ID string to number on optimistic local insert
- Feat: notify user on sign-in page when auto-logged-out due to session expiry

## 2026-06-23

- Docs: update rate-limit window references from 10/min to 10/15s
- Feat: replace rate-limit modal with inline notice and shorten window to 15s
- Explicitly allowlist the playwright MCP server to skip the trust prompt

## 2026-06-22

- Add data-testid attributes to auth, chat, and account UI for stable browser-automation selectors
- Harden Playwright MCP config: pin version, audit logging, tool deny rules, and token-saving flags
- Add Playwright MCP server config with isolated profile and localhost-only origin allowlist
- Feat: show rate-limit modal with 60s countdown when sendMessage hits TOO_MANY_REQUESTS

## 2026-06-21

- Fix: log access token expiry distinctly instead of generic 401 in JwtAuthGuard/GraphQLAuthGuard
- Fix: ignore admin dotenv files to match frontend convention
- Feat: enforce nickname uniqueness with a DB-level UNIQUE constraint
- Docs: document superadmin role tier in CLAUDE.md UserRole description
- Fix: coerce GraphQL ID string to number when keying nickname lookup maps
- Fix: sync socket reconnect with refresh-token logout instead of retrying expired token forever

## 2026-06-20

- Feat: poll admin nickname lookups every 60s to match existing frontend convention
- Docs: document session-guard.ts pattern in CLAUDE.md

## 2026-06-19

- Feat: surface user nicknames in admin Users, Rooms, and Logs pages instead of raw IDs/email
- Fix: align entity FK cascade/nullable metadata with actual DB schema for chat and AI-room relations
- Fix: prevent silent cross-tab account takeover on shared refreshToken cookie
- Fix: resolve duplicate migration timestamp between AddUserNickname and CreateAuditLog

## 2026-06-18

- Feat: nickname at registration with uniqueness check, AccountPage layout redesign
- Fix: password leak via missing serializer, stale role cache, RBAC bypass on audit log, admin signout method, and bind local dev server to loopback

## 2026-06-17

- Fix: postgres 18 volume mount path to match version-specific PGDATA
- Feat: add action filtering and pagination to audit log API and admin Logs page
- Fix: AuthModule/UserModule circular DI, getUserNicknames test, nickname max length validation
- Feat: role-change notification email via SMTP, harden audit log/pubsub/redis typing for null targetId and CachableMessage participant
- Test: add Vitest setup and unit tests for admin auth store, axios interceptor, and protected route
- Feat: user nickname field with display in chat and account profile edit
- Docs: document admin panel Vercel deployment as separate project (frontend pattern)
- Update: .env.example; varibale update
- Feat: audit log viewer endpoint and admin panel Logs page; update README for superadmin/MAX_ADMIN_COUNT

## 2026-06-16

- Feat: superadmin role, audit log (DB+file), admin count limit with last-superadmin guard
- Chore: add *.tsbuildinfo to admin .gitignore
- Style: make RoomInfoType fields optional to satisfy strict TypeScript
- Feat: admin frontend package — login, users, rooms pages with Vite + Apollo + Tailwind
- Feat: admin role system — role change, force logout, room management, admin-bypass deletion
- Feat: user withdrawal — FK cascade migration, remove() rewrite with session/socket/token cleanup, orphan room deletion, password confirm, account page

## 2026-06-15

- Style: normalize line endings (LF→CRLF) and remove redundant as ChatEntity[] cast in chat.service.ts via pnpm lint --fix
- Fix: auth.service, auth.controller, user.controller, main; type JWT payload, remove redundant async, type req.user/cookies, handle bootstrap promise
- Update: user.controller.ts, CLAUDE.md, README.md, README.ko.md; add admin bypass to PATCH/DELETE, fix UserRole enum docs, add admin account DB INSERT guide
- Fix: chat.gateway, auth.service, redis.service, jwt.strategy, chat.resolver, chat-page; remove non-null assertions, any types, unsafe JSON.parse, and floating promises for runtime and type safety
- Update: app.module.ts, .env.example; add USER_CACHE_TTL_SEC, SESSION_TTL_SEC, MESSAGE_CACHE_TTL_SEC to Joi required validation and replace concrete TTL values with ttlSec placeholder
- Update: CLAUDE.md; meta-principle sections anchored to project entrypoints, frontend conventions section added
- Fix: auth.service, jwt.strategy, user.service, all-exceptions.filter; replace node-redis client type and set() syntax with ioredis equivalents, throw GraphQLError to surface errors in Network response
- Fix: ai.service; replace node-redis client type and set() syntax with ioredis equivalents to resolve ERR syntax error

## 2026-06-13

- Fix: .dockerignore; .env.local added to prevent backend env file from being copied into Docker image
- Fix: rate-limit.guard; userId scoped outside try block, err cast replaced with instanceof narrowing
- Update: package.json; onlyBuiltDependencies added for native module build control

## 2026-06-12

- Update: package.json; coveragePathIgnorePatterns addition of exception filter

## 2026-06-11

- Refactor: extract aiPersonality from RoomEntity into AiRoomEntity; fix stale specs for ioredis/broadcastFn/clientConnection changes
- Refactor: chat.gateway, chat.service - @socket.io/redis-adapter; clientConnection Map removed, server.to/in replaces direct socket emit
- Refactor: chat.gateway, chat.service, chat.resolver, ai.service, chat.module; unused WS sendMessage handler and Socket.IO broadcast removed

## 2026-06-10

- Style: ai.service.spec, auth.controller, all-exceptions.filter, chat.module, rate-limit.guard - prettier auto-format applied
- Refactor: pubsub.service, chat.resolver; cacheMessage moved into publish override, removed standalone cache call from resolver
- Refactor: redis.module, redis.service, rate-limit.guard; node-redis replaced with ioredis for unified Redis client
- Fix: chat-page - api.post('/auth/signOut') added to blacklist token and clear httpOnly cookie on logout
- Fix: signin-page - refreshToken argument dropped from setTokens call to match updated store signature
- Refactor: protected-route - refreshToken state check removed; refresh attempted whenever accessToken is absent
- Refactor: apollo - refreshToken removed from errorLink retry and wsLink connectionParams
- Refactor: axios - refreshToken Authorization header removed from refresh interceptor; cookie auto-sent via withCredentials
- Refactor: auth.store - refreshToken removed from state and localStorage; accessToken kept in-memory only
- Feat: auth.controller - signIn/signOut set and clear httpOnly cookie; refreshAccess reads from cookie instead of header
- Feat: main.ts - cookie-parser middleware registered before global pipes
- Dep: package.json, pnpm-lock - cookie-parser added for httpOnly refreshToken parsing
- Fix: app.module - ChatResolver removed from providers; already registered via ChatModule import

## 2026-06-09

- Add: all-exceptions.filter - global exception filter added dev/prod split; chat.resolver - InternalServerErrorException; main.ts - useGlobalFilters registered; internal error exposure blocked
- Fix: logger - correct levels, add user context, add missing log entries across all modules

## 2026-06-08

- Fix: ws.transaction.interceptor, rate-limit.guard; release on commit failure, context-aware exceptions, unified rate-limit key
- Fix: ws.transaction.interceptor, rate-limit.guard; release on commit failure, context-aware exceptions, unified rate-limit key
- Update: CLAUDE.md; Updated with advanced analysis detailed and structure consistent queries
- Fix: chat.resolver, ws.transaction.interceptor; isolate 'cacheMessage' failure from pubSub and commit paths
- Update: CLAUDE.md; Updated with advanced analysis detailed and structure consistent queries

## 2026-06-07

- Fix: logger - corrected log levels, removed token exposure, added stack traces
- Fix: user.controller - GET :id IDOR ownership check; graphql.auth.guard - ctx.req guard, dead fallback removed; graphql-operations - SendMessageVariables type added; chat-page - sendMessage input cleaned, mutation typed; user profile IDOR blocked, GraphQL auth hardened, frontend type safety
- Update: chat-page; the messages weren't sent since room and recipientId were sent together in the input therefore recipientId has removed from the field
- Update: schema.gql
- Fix: auth.service - credential logging, DB role refresh; auth.controller - HTTP codes, Bearer; rbac.guard - >= comparison; role.ts - UserRole rename; user.controller - IDOR, admin-only; user.service - findAll standardized; chat.resolver, chat.service - room IDOR guard; ai.service - bcrypt hashing; payload.interface, user.entity - role type sync; security audit IDOR blocked, privilege escalation prevented, auth consistency, admin foundation

## 2026-06-06

- Fix: create-user.dto, user.controller, user.service - IDOR and role escalation; redis.service - atomic sethUserOnline; pubsub.service - TLS support; create-chat-input.type - dead fields removed
- Debug: auth.controller, auth.service, chat.gateway, chat.resolver, chat.service, redis.service.spec; Sensitive infos logging removed, IDOR vulnerability fixed by verifying room participants, HTTP status codes fixed for wrongly written, Swagger documentation error fixed for using the unmatched decorator @ApiBasicAuth for parseBearerToken() logic and wrong camel cases, GraphQL Resolver re-parsing tokens removed for reuse of ctx.req.user.id"

## 2026-06-05

- Update: README.md, READEME.ko.md
- Update: README.md, READEME.ko.md
- Update: README.md, READEME.ko.md
- Update: README.md, READEME.ko.md
- Update: README.md, READEME.ko.md
- Update: README.md, READEME.ko.md
- Update: README.md, READEME.ko.md

## 2026-06-04

- Update: README.md, READEME.ko.md; Added Redis Pub/Sub, Flow of the Chat, GraphQL mutation path
- Update: READEME.ko.md; few of changes
- Update: README.md, READEME.ko.md, .env.example; Description of newly added AI feature and few of changes
- Debug: ws.transaction.interceptor, chat.resolver, user.service, redis.service; Redis cache write-after-commit, invalidation on user removal, cache size alignment, and TTL externalization

## 2026-06-02

- Debug: chat-page.tsx
- Update: chat-page, chat.service, chat.gateway; Updated horizontal scrollable 'Conversations' banner with left/right buttons and auto-scroll to select registered users
- Debug: chat.service, chat.gateway; Debugged for adding optional type, and removing unnecessary await on client.data.user

## 2026-06-01

- Debug: schema.gql, chat.gateway, chat.service.ts, chat.resolver.ts, migration file, graphql-operations.ts, chat-page.tsx; Debugged previously what all of registered users but went offline without having conversations were not able to be visible in Conversations banner, Test: ai.service.spec
- Debug: chat.page.tsx; Updated for delaying socket reconnection for 3 seconds after expiry of access token to avoid loop hell
- Debug: chat.page.tsx; offline users to be shown on the conversation banner for each others, Each of users themselves to be shown primarily on the conversations banner
- Debug: chat.gateway; online users are not shown on the conversation banner for each others
- Debug: ai-room.service, ai.service, system-prompt, chat.resolver, room.entity, migration file, chat-page.tsx; 1) users to change the AI personality number of times, 2) pop up AI personality selection page only when users select the AI, not right after login, 3) smart scroll, Test: ai-room.service.spec, ai.service.spec
- Debug: ai.service, ai-personality-info.type; Gemini does not answer

## 2026-05-30

- Debug: ai.service; Gemini does not answer
- Debug: ai.service, chat.resolver; Gemini does not answer
- Debug: ai.service, chat.resolver; Gemini does not answer, Test: ai.service.spec
- Update: schema.gql

## 2026-05-29

- Update: .env.example
- Debug: docker-compose, settings.local, InitialSchema; Debugged for the unhealthy chatproject while uploading the image on docker
- Debug: Dockerfile; pnpm couldn't make symbolic link with @nestjs/cli with ackend/node_modules on Alpine, which led couldn't run est build to execute, Test: ai-room.service.spec, ai.service.spec
- Update: package.json; coveragePathIgnorePatterns, ai.service.ts; ln:42 failed to track the path of initialization since the 'aiUser' variable applied from asynchronous lifecycle hook in constructor
- Update: AI Chat Bot for registered users

## 2026-05-28

- Remove: package.json, pnpm-lock.yaml; Removed 'brace-expansion' from overrides for lint execution
- Remove: Bunch of backend files blank remove, Debug: apollo.ts; Debugged by rxjs installation

## 2026-05-27

- Update: .github/workflows/deploy.yml, .gitignore, .vscode/launch.json, CLAUDE.md, backend/Dockerfile, backend/package.json, docker-compose.yml, frontend/package.json, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, railway.toml; Updated files pathway since the move of all of backend files into the 'backend' folder, Move: Moved all of NestJs backend files into the 'backend' folder
- Update: CLAUDE.md; Improved Claude instructions for optimization of development environment
- Testing: auth.service.spec, chat.service.spec, redis.service.spec, user.service.spec

## 2026-05-26

- Fixation: chat.module, user.service, rate-limit.guard, redis.service; Fixations for Redis scalability, DB load reduction, and race condition handling
- Update: jwt.strategy, chat.resolver, chat.service, rate-limit.guard, redis.service; Updated for redis to take the charge of case of increases of the users
- Update: signin-page.tsx; Updated background color of register

## 2026-05-25

- Update: chat-page.tsx; Updated positioning Users right next to Conversations banner

## 2026-05-24

- Update: graphql-operations, chat-page.tsx, chat.resolver; Updated the enter to send, and timestamp on messages.
- Debug: chat-page.tsx; Debugged senders leaving messages to the signed out/offline users
- Testing
- Debug: graphql-operations, chat-page.tsx, auth.store, chat.resolver, chat.service; Debugged senders leaving messages to the signed out/offline users, Create: room-info.type.dto; created it for the same reason

## 2026-05-23

- Debug: chat-page, socket.ts; Socket 'Session ID unknown'
- Debug: chat-page; Socket 'Session ID unknown'
- Update: chat-page, auth.store; Updated querying latest messages for offline users who signed in back, showing offline recipients on banner

## 2026-05-22

- Debug: vercel.json, axios.ts; Debugged when the access token expires, it refreshes the access token automatically via the refresh token
- Debug: axios.ts; Debugged spell mistakes, token misused in requesting access token, null user ID in page refresh
- Debug: chat.service.spec; testing
- Debug: chat.resolver; Debugged sending the ghost messages to online recipients, Fix: chat.service; Fixed some of loggers
- Debug: graphql-operations, chat.resolver, message-type.dto; Signed out/offline users to load up messages by querying the previous chatted room
- Debug: chat.resolver; Debugged senders leaving messages to the signed out/offline users
- Debug: graphql-operations, chat-page.tsx, chat.resolver, chat.service; Debugged senders leaving messages to the signed out/offline users
- Update: apollo.ts, protected-route.tsx; Updated when the access token expires, move the user to the main sign in page
- Update: apollo.ts; Updated when the access token expires, move the user to the main sign in page
- Update: chat-page.tsx; Sender selecting recipient via badnner
- Debug: chat.service.ts, chat.service.spec; Debugged sending messages to offline recipients, testing

## 2026-05-21

- Debug: graphql-operations, chat.service.ts, chat-page.tsx, chat.resolver; chat.service.spec; Debugged for load up history of chats, testing
- Debug: apollo.ts; Debugged not refreshed accessToken in expiry, chat.service; Activate immediate subscription for recipient when sender send a message first
- Debug: chat-page.tsx; Sending message duplication on board by sender
- Debug: chat.service; Sending message duplication on board by sender
- Debug: chat-page.tsx; Sending message duplication on board by sender
- Debug: graphql-operations, chat-page.tsx, chat.resolver, message-type.dto; Messages to pop up on board
- Debug: chat.resolver; PubSub mismatch
- Debug: main.ts; It seems that the website CORS was blocking the POST request
- Debug: apollo.ts; headers wasn't included in request
- Debug: apollo.ts, jwt.strategy; Debugged for CSRF failure

## 2026-05-20

- Debug: auth.service.spec; Token formation failure
- Debug: auth.service.spec, redis.service.spec, redis.service; Debugging test failures

## 2026-05-19

- Update: schema.gql; Showing online users status on banner
- Update: chat-page.tsx; Showing online users status on banner
- Update: graphql-operations, chat.resolver.ts, chat.module, pubsub.service, redis.service; Showing online users status on banner
- Debug: chat.resolver.ts, auth.controller, auth.service, jwt.strategy

## 2026-05-18

- Debug: chat.resolver.ts; Redis wasn't used for checking online status before publish the messages
- Merge branch 'main' into dev
- Update: chat-page.tsx
- Inspection: chat-page.tsx

## 2026-05-15

- Merge branch 'main' into dev
- Create: tsconfig.app.tsbuildinfo
- Update: README.md; Updated for newly added frontend for description
- Debug: chat.gateway.ts; Debugged for Socket.IO CORS error when sending messages, and 'Recipient not online' when attempt to send
- Debug: app.module.ts; Debugged for app.module since the port could be the reasons for the 502 problem
- Debug: railway.toml; Debugged for Railway deployment since the server haven't started after migration
- Debug: railway.toml; Debugged for Railway deployment since the server haven't started after migration
- Debug: railway.toml; Debugged for Railway deployment since the server haven't started after migration, Update: docker-compose.yml; No CMD exist in the file
- Debug: railway.toml; Debugged for Railway deployment since the server haven't started after migration
- Debug: railway.toml; Debugged for Railway deployment since the server haven't started after migration
- Debug: railway.toml; Debugged for Railway deployment since the server haven't started after migration
- Debug: Dockerfile; Debugged for Railway deployment since the server haven't started after migration
- Debug: railway.toml; Debugged for Railway deployment since the server haven't started after migration
- Update: CORS change for frontend deployment
- trigger: vercel redeploy

## 2026-05-14

- Debug: data-source.ts; Debugging of Railway could not read variables via .env
- Debug: data-source.ts; Debugging of Railway could not read variables via .env
- trigger: vercel redeploy

## 2026-05-13

- trigger: vercel redeploy
- trigger: vercel redeploy
- trigger: vercel redeploy
- Debug: tsconfig.app.json; Failure of deployment of Vercel
- Debug: tsconfig.app.json; Failure of deployment of Vercel
- Install: pnpm install; To reflect pnpm-lock.yaml with jwt-decode in frontend for solving Github Action error of ou should configure 'pnpm.overrides' at the root of the workspace instead.
- Debug: pnpm-workspace.yaml; Deployment on Vercel
- Revert "Debug: pnpm-workspace.yaml; Deployment on Vercel"
- Debug: pnpm-workspace.yaml; Deployment on Vercel
- Debug: Installation of 'jwt-decode'; Build Logs: src/pages/signin-page.tsx(6,27): error TS2307: Cannot find module 'jwt-decode' or its corresponding type declarations.

## 2026-05-12

- Debug: Deployment on Vercel; logger.ts
- Debug: Deployment on Vercel; logger.ts
- Debug: deploy.yml; [ERR_PNPM_LOCKFILE_CONFIG_MISMATCH] Cannot proceed with the frozen installation. The current 'overrides' configuration doesn't match the value found in the lockfile

## 2026-05-11

- Update: Dockerfile, Package.json; packageManager
- Update: Dockerfile; Removed one of pnpm versions to avoid version mismatch errors like ERR_PNPM_BAD_PM_VERSION
- Merge pull request #10 from Bluecode77732/railway/code-change-mQO8gz
- fix: pin pnpm@10.33.0 in Dockerfile and package.json
- Merge pull request #9 from Bluecode77732/railway/code-change-v9xaqd
- fix: set railway builder to DOCKERFILE and verify lockfile overrides
- Update: .gitignore; backend
- Merge branch 'dev'
- Update: .gitignore; backend, Create: .gitignore; frontend

## 2026-05-09

- Update: chat-page.tsx, graphql-operations, chat.resolver; GraphQL Operation Set Up, apollo.ts; Link GraphQL authentication header to HTTP request to send tokens

## 2026-05-08

- Update: chat-page.tsx; GraphQL Operation Set Up
- Previous Commitment Titled Wrong => Update: chat-page.tsx; sign out added
- Update: chat-page.tsx, signin-page.tsx; Added Register Page
- Create: register-page.ts.tsx, Update: App.tsx, signin-page.tsx; Added Register Page
- Debug: chat-page.tsx; Debugged for, Pressing the send button twice to send, Can't deliver input value,  Delivering blank space, Cannot seeing the other person's message
- Debug: chat-page.tsx; Added 'RecipientId' and fixed sending message boxes(box and button) chat UI design
- Debug: chat.gateway.ts; Since the @WebSocketGateway cannot recognize CORS Origin URL in env, brought the Origin URL into the gateway itself
- Debug: main.ts; credential => credentials
- Debug: data-source.ts; Migration location fix, Configuration: tsconfig.app.json; Configured for proper use of React and Vite, tsconfig.json; TS type check inclusion, Create: vite-env.d.ts; Create a type environment file for TS by Vite to prevent import.meta.env error since TS doesn't have env in ImportMeta type, Modify: axios.ts, socket.ts

## 2026-05-07

- Update: chat-page.tsx; Updated rendering message
- Update: chat-page.tsx; Updated rendering message
- Install: jwt-decode; Extract userId through JWT decode to identify the User ID, Update: Senders identify by ID; signin-page.tsx, chat-page.tsx
- Update: chat-page.tsx; Update handling error
- Update: chat-page.tsx; Update handling error, Change: auth.store; user ID identify
- Install: dompurify, -D @types/dompurify; To fix XSS vulnerability on msg.message script copiable when render
- Update: chat-page.tsx, Change: signin-page.tsx; Changed file name from 'login' to 'signin'

## 2026-05-06

- Implement: Front-end pages; chat-page.tsx, Update: App.tsx; ChatPage
- Implement: Front-end pages; chat-page.tsx, Update: App.tsx; LoginPage, login-page.tsx; LoginPage, auth.store.ts; XSS vulnerability, Leakage to third party when save in localStorage

## 2026-05-05

- Implement: Front-end pages; App.tsx, main.tsx, apollo.ts, axios.ts, protected-route.tsx, login-page, socket.ts, auth.store.ts

## 2026-05-02

- Implement: App.tsx
- Install: Pacakge; axios socket.io-client @apollo/client graphql zustand react-router-dom react-hook-form, Dependency; -D tailwindcss @tailwindcss/vite, Removed: React assets, Configuration: Configuration of Tailwind
- Implement: Frontend; Vite Build Tool + React Libray
- Adopt: CORS; for allowing my website to trust specific API's origin of resource securely
- Update: README.md; Swagger UI url as document not doc, Debug: package.json; In a doing of Migration, 'tsconfig-paths' could not find 'tsconfig.json' as migration performed by compiled file, which is 'dist/data-source.ts', thus tsconfig.json hadn't been found

## 2026-05-01

- Debug: package.json, pnpm-lock.yaml, data-source-source.ts; Migration for Docker
- Update: docker-compose.yml
- Update: app.module
- Update: .dockerignore; Since separated by local/production environment, added '.env.production' on it
- Update: docker-compose.yml; Since separated by local/production environment, changed route of 'env_file'
- Update: README.md; Docker, app.module; envFilePath, docker-compose, .gitignore
- Update: README.md; Docker
- Update: README.md, Create: Dockerfile, docker-compose.yml, .dockerignore

## 2026-04-30

- Update: deploy.yml; pnpm test
- Update: README.md

## 2026-04-29

- Update: README.md
- Update: README.md
- Debug: auth.service.spec; error for mocking 'bcrypt' mocking, user.service.spec; error for mocking 'bcrypt' mocking, Test: pnpm test throws Test Suits: 0/4 failed, Tests: 0/43 failed/Coverage 89.71%, Remove: package.json; Removed 'minimatch' from pnpm/overrides for solving 'minimatch' conflict in pnpm test:cov test, Create: src/mocks/bcrypt.ts; Created for mocking 'bcrypt' module for coverage testing
- Prune: chat.service.spec; Unused codes
- Debug: chat.service.spec; pnpm test throws Test Suits: 0/4 failed, Tests: 0/43 failed
- Debug: chat.service.spec; pnpm test throws Test Suits: 0/4 failed, Tests: 0/43 failed
- Debug: chat.service.spec; pnpm test throws Test Suits: 1/4 failed, Tests: 2/43 failed
- Debug: chat.service.spec; pnpm test throws Test Suits: 1/4 failed, Tests: 2/43 failed
- Debug: chat.service.spec; pnpm test throws Test Suits: 1/4 failed, Tests: 4/43 failed

## 2026-04-28

- Debug: chat.service.spec; pnpm test throws Test Suits: 1/4 failed, Tests: 0/23 failed
- Debug: auth.service.spec; pnpm test throws Test Suits: 1/4 failed, Tests: 9/43 failed
- Debug: auth.service.spec; pnpm test throws Test Suits: 2/4 failed, Tests: 9/27 failed
- Debug: auth.service.spec, chat.service.spec; pnpm test throws Test Suits: 2/4 failed, Tests: 12/43 failed

## 2026-04-27

- Debug: auth.service.spec; exception couldn't be thrown as verifyAsync returns { type:'access' }, chat.service.spec; pnpm test throws Test Suits: 2/4 failed, Tests: 0/7 failed
- Debug: chat.service.spec; pnpm test throws 2/4 failed, 13/27 failed

## 2026-04-25

- Debug: auth.service.spec, chat.service.spec; pnpm test throws 2/4 failed, 14/27 failed
- Debug: create-user.dto; Undefined type error
- Debug: user.service.spec, auth.service.spec, chat.service.spec; pnpm test throws 2/4 failed, 14/27 failed
- Debug: user.service.spec, auth.service.spec, create-user.dto; pnpm test throws 3/4 failed, 15/27 failed

## 2026-04-24

- Debug: user.service.spec, auth.service.spec; pnpm test throws 3/4 failed, 16/27 failed
- Debug: redis.service.spec; pnpm test throws 3/4 failed, 24/43 failed
- Update: chat.service
- Update: chat.service
- Debug: Testing files; pnpm test throws 4/4 failed, 27/43 failed

## 2026-04-23

- Update: tsconfig.json; Solving of Test files type errors
- Update: railway.toml; Updated command to pnpm migration:run && pnpm run start:prod since Railway DB wasn't created via command
- Update: deploy.yml; skipping ESLint type error temporally
- Removed: package.json; 'ajv': '>=8.18.0', deploy.yml; ESLint: Typescript type changes for each files

## 2026-04-22

- Install: lint
- Update: deploy.yml; ESLint
- Update: deploy.yml; CI/CD
- Update: deploy.yml; CI/CD
- Update: deploy.yml; CI/CD
- Create deploy.yml
- Delete: deploy.yml
- Update: deploy.yml; CI/CD
- Update: deploy.yml; CI/CD
- Merge branch 'main' of https://github.com/Bluecode77732/Chat-project
- Update: deploy.yml; CI/CD
- Update: deploy.yml; CI/CD
- Create deploy.yml
- Update: deploy.yml; CI/CD
- Remove: main.yml; Removed the duplicated yml file
- Merge branch 'main' of https://github.com/Bluecode77732/Chat-project
- Update: deploy.yml; CI/CD
- Create CI/CD workflow for Chat Project
- Update: deploy.yml; CI/CD
- Install: @apollo/server; For using GraphQL module by peer dependency
- Remove: Removed the packages audit file
- Update: package.json; Updated version of the vulnerability in using packages for running Github Action
- Update: package.json; Updated version of the vulnerability in using packages for running Github Action
- Update: package.json; Updated version of the vulnerability in using packages for running Github Action
- Update: README.md; Uninstalled @apollo/server, Update: package.json; Updated version of the vulnerability in using packages for running Github Action
- Debug: railway.toml, main.ts; node version error

## 2026-04-21

- Merge pull request #7 from Bluecode77732/railway/code-change-lY-a4q
- fix: move node:crypto import to first line of main.ts
- Debug: package.json; node version error
- Merge branch 'main' into dev
- Merge pull request #6 from Bluecode77732/railway/code-change-Z2qt12
- Debug: package.json; node version error
- Debug: package.json; node version error
- Debug: railway.toml
- Debug: railway.toml
- Debug: deploy.yml
- Debug: railway.toml
- fix: add node:crypto import in app.module.ts for TypeORM UUID support
- Create: railway.toml, Debug: railway.toml
- Update: deploy.yml; CI/CD
- Created: deploy.yml; CI/CD

## 2026-04-20

- Update: README.md; Quick Start

## 2026-04-19

- Update: README.md; Live Demo

## 2026-04-18

- Update: .env.example; REDIS_URL
- Merge pull request #5 from Bluecode77732/railway/code-change-t4tobc

## 2026-04-17

- fix: correct REDIS_URL null guard in pubsub.service.ts

## 2026-04-15

- Debug: pubsub.service; Deployment
- Debug: redis.module; Deployment
- Merge pull request #4 from Bluecode77732/railway/code-change-tCqD9r
- fix: resolve hardcoded localhost Redis in pubsub.service.ts
- Debug: redis.module; Deployment
- Merge pull request #3 from Bluecode77732/railway/code-change-4XfbMG
- fix(redis): inject ConfigService and remove spurious error log
- Merge branch 'dev' of https://github.com/Bluecode77732/Chat-project into dev
- Debug: redis.module; Deployment
- Merge pull request #1 from Bluecode77732/railway/code-change-74WJbm
- fix(chat): replace hardcoded Redis URL with REDIS_URL env var

## 2026-04-14

- Update: README.md; Migration
- Added: Migration
- Update: app.module

## 2026-04-07

- Uncomment: app.e2e-spec, Update: pubsub.service

## 2026-04-06

- Update: tsconfig; ignoreDeprecations, create-chat-input.type; comment

## 2026-04-05

- Update: tsconfig; ignoreDeprecations
- Install: pnpm i --save-dev @types/jest, Update: README.md, Debug: All of files causing undefined error, chat.service; undefined type error - assuming uninstalled packages
- Update: README.md, Debug: All of entities, chat.service; undefined type error - assuming new version of Typescript or Nest.Js

## 2026-04-04

- Prune: auth.controller, Debug: auth.service; catch type error

## 2026-04-03

- Prune: rbac.guard
- Prune: rbac.guard

## 2026-04-01

- Update: README.md
- Update: README.md
- Update: README.md
- Update: README.md
- Update: chat.service, rate-limit.guard, redis.module; logger

## 2026-03-31

- Merge branch 'main' into dev for Pub/Sub or Socket.IO Redis Adapter implementation
- Update: jwt-auth.guard

## 2026-03-26

- Update: README.md
- Update: README.md

## 2026-03-24

- Prune: auth.controller, auth.service | Update: chat.service

## 2026-03-23

- Prune, Update
- Prune, Update

## 2026-03-17

- Update: README.md
- Update: README.md
- Prune: chat.service, redis.service, Update: README.md
- Update: README.md

## 2026-03-16

- Update: README.md
- Update: README.md
- Update: README.md
- Update: README.md
- Prune: chat.gateway
- Test, Prune: chat.gateway

## 2026-03-10

- Update: README.md

## 2026-03-09

- Update: README.md, Uninstall: package.json, Prone: app.module
- Update: README.md

## 2026-03-08

- Update: README.md

## 2026-03-07

- Test: chat.service(70.47% of coverage)

## 2026-03-06

- Test: chat.service(70.47% of coverage), Pruned: chat.service

## 2026-03-05

- Pruned: chat.service
- Improve: Replaced 'entityManager' to 'QueryRunner' for Transaction Handling on each single connection for persistent data flow and storage safety

## 2026-03-03

- Debug - 'Failed to send message: Failed to send message: Cannot read properties of undefined (reading 'rooms')'; 'This called BEFORE null check': Commented out
- Fix: Removed showing password
- Debug - 'Failed to send message: Failed to send message: Cannot read properties of undefined (reading 'rooms')'
- Debug - Save message in DB: ollbackTransaction => Implemented commitTransaction which wasn't added., Debug - Save message in DB: added try/catch/finally, commitTransaction(), ollbackTransaction(), elease() in 'chat.resolver'
- Debug - Save message in DB: added try/catch/finally, commitTransaction(), ollbackTransaction(), elease()"
- Debug - Save message in DB: commitTransaction()"
- Debug - Save message in DB: commitTransaction()"

## 2026-03-02

- Debug - Solving on 'Cannot Find Sender ID': Seems jwt strategy passport cannot populates eq.user, so GraphQL context cannot find sender id.
- Debug - Solving on 'Cannot Find Sender ID' : Registration of 'chat.resolver'
- Debug - Solving on 'Cannot Find Sender ID' : Registration of 'chat.resolver'
- Debug - Solving on 'Cannot Find Sender ID' : Registration of 'chat.resolver'
- Update: README.md
- Debug: Solving on 'Cannot Find Sender ID'
- Debug: Solving on 'Cannot Find Sender ID'

## 2026-03-01

- Debug: serializedMessage"
- Debug: Implement transaction for sendMessage in chat.service, Debug: Inject QueryRunner for transaction when client request to GraphQL, Debug: Requiring socketId forcefully was the reason for unable to send msg through GraphQL, Debug: double lifecycle management, the same resource being controlled by two owners simultaneously => Removed transaction queryRunner

## 2026-02-27

- Debugged: Save message in DB, few lines of changes

## 2026-02-26

- READ PREVIOUS COMMITMENT HISTROY => Debugged: sendMessage => SessionCacheService; non-serializable object converting error - template literal tries to convert Redis object into string
- Debugged: sendMessage; non-serializable object converting error - template literal tries to convert Redis object into string, Test: chat.service, etc

## 2026-02-25

- Debug: sendMessage; non-serializable object converting error, Test: chat.service, etc
- Update: README.md
- Update: README.md

## 2026-02-24

- Debugged: Seems working with 'test.js' and data stored in place. The Postman seems to have limitation on receving sender's messages to recipients, WOP: chat.gateway.spec, Fix: auth.service, Modify: chat.service; Adopt RBACguard
- Debugging: Postman invisibility on receving sender's messages to recipients, Modify: chat.gateway, Additional: chat.service

## 2026-02-22

- Debugging: sendMessage, getOrCreateRoom; issues recipients cannot see senders message
- Update: README.md, sendMessage parameter update; server seemingly don't require to connect to the sockets

## 2026-02-20

- Update: README.md
- Update: README.md

## 2026-02-16

- Test: chat.service

## 2026-02-15

- Debug: GraphQL connection, GraphQL connection - Comment Out, GraphQL connection - Update pubsub.service.ts to use existing Redis configuration

## 2026-02-14

- Modify: app.module; GraphQL connection, auth.controller, auth.service, jwt.strategy

## 2026-02-11

- Modify: chat.service: sendMessage; GraphQL connection, chat.module: provider; Server
- Modify: chat.service: sendMessage; GraphQL connection

## 2026-02-10

- Merge branch 'dev' of https://github.com/Bluecode77732/Chat-project into dev1
- Modify: CreateChatInput; @Field(() => String)
- Modified: The oom element; oomId => oom"
- Added chat.module in app.module as provider
- Package installation: @nestjs/graphql
- Merge branch 'main' of https://github.com/Bluecode77732/Chat-project into dev1

## 2026-02-08

- Debugged and Modified: chat.service - getOrCreateRoom; getUserSocketId, connect, sendMessage; Redis adoption, chat.gateway - handleDisconnect, etc

## 2026-02-06

- Merge branch 'main' of https://github.com/Bluecode77732/Chat-project into dev
- additional logger implementation
- Debug: sendMessage; chatRoom => room
- Debug: sendMessage; chatRoom => room

## 2026-02-05

- Merge branch 'dev' of https://github.com/Bluecode77732/Chat-project
- Redis Implmentation
- few changes
- few changes
- Merge remote-tracking branch 'refs/remotes/origin/dev' into dev
- Merge branch 'main' of https://github.com/Bluecode77732/Chat-project into dev
- Test: chat.service; sendMessage - 'lines coverage': 51.19%, Changes: README.md

## 2026-02-04

- test: chat.service; sendMessage - 'lines coverage': 51.19%

## 2026-02-01

- test: chat.service; mockRecipient - lines coverage: 51.19%
- test: chat.service - lines coverage: 42.85%

## 2026-01-30

- test: chat.service - lines coverage: 40.47%
- test: chat.service - lines coverage: 35%
- test: chat.service

## 2026-01-29

- test: chat.service

## 2026-01-27

- test:coverage, renamed few of file for test, removed logger dependency injection from chat.service
- logger debug

## 2026-01-26

- logger improvments

## 2026-01-23

- Implementation of logger
- Commitment on testing Socket through GraphQL real time responses; wop

## 2026-01-22

- Testing Socket through GraphQL real time responses

## 2026-01-21

- few of commitments
- debug: issueToken did not include and send sub.id

## 2026-01-19

- chat.service comments addition

## 2026-01-16

- Merge branch 'dev' of https://github.com/Bluecode77732/Chat-project into dev
- debugged: In Postman, A - participantId:2 = B - participantId:1, added wait queryRunner.commitTranscation(), sending messages works from both-side, sucessfully both participants joins a room, sucessfully saves messages in DB

## 2026-01-14

- debugged, works from one-side
- total fixation; separation multi-aligned transactions into 3 logics, and debugged

## 2026-01-13

- createMessage and getAndCreateRoom commitment

## 2026-01-10

- total fixation
- getAndCreateRoom fix

## 2026-01-09

- created 'dev' branch, broadly modified chat service
- debugged for another debug

## 2026-01-08

- debug

## 2026-01-06

- few changes

## 2026-01-05

- debug of few lines modify, authorization by role added on user

## 2026-01-04

- debug on 'joinRooms' relation names, debugs

## 2026-01-03

- 'RoomEntity | null' type error debug: solved via '!', finished the logics createRoom and createMessage
- validateUser, getRoom, createRoom

## 2026-01-02

- Built user, auth, chat entities, relations, guard, interceptors, etc

