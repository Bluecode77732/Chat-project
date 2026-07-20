# Roadmap

## Build Timeline (2026-01 ~ 2026-07)

How this project actually got here — phases reconstructed from `git log`, not
recollection. Dates are when each phase's defining commit landed; several phases overlap rather than
running cleanly end-to-end (the Socket.IO→GraphQL migration in particular took ~5 months to fully
land). For the full commit-by-commit record, see [CHANGELOG.md](CHANGELOG.md).

```mermaid
gantt
    title Build Timeline
    dateFormat YYYY-MM-DD
    axisFormat %b
    section Core
    Foundation (entities, auth, guards)         :done, 2026-01-02, 20d
    Socket.IO -> GraphQL messaging migration     :done, 2026-01-22, 141d
    section Infra
    CI/CD workflow                               :done, 2026-04-22, 9d
    Docker Compose + monorepo restructure        :done, 2026-05-01, 27d
    section Features
    AI chat integration (Gemini)                 :done, 2026-05-29, 18d
    Admin panel + RBAC/audit system               :done, 2026-06-16, 2d
    section Hardening
    Security incident response                   :crit, done, 2026-06-18, 1d
    Transaction pattern formalization             :done, 2026-07-02, 1d
    Behavioral moderation system                  :done, 2026-07-11, 1d
    Documentation overhaul                        :done, 2026-07-15, 6d
    Security & observability hardening            :done, 2026-07-18, 2d
    Doc-integrity CI enforcement                  :active, 2026-07-18, 3d
```

1. **Foundation** (2026-01-02 ~ 2026-01-21) — first commit: "Built user, auth, chat entities,
   relations, guard, interceptors, etc." Base JWT auth, TypeORM entities, and an initial Socket.IO
   chat prototype.
   *Why:* practicing authentication/authorization end-to-end (Basic/Bearer/JWT, RBAC guards) —
   per README's [Project Motivation](README.md#project-motivation) — before building anything else on
   top of it.

2. **Socket.IO → GraphQL messaging migration** (2026-01-22 ~ 2026-06-11) — the longest-running phase,
   not a clean cutover. GraphQL message delivery testing started 2026-01-22 ("Testing Socket through
   GraphQL real time responses"); an early transaction implementation for `sendMessage` landed
   2026-03-01; the old Socket.IO message handler wasn't actually deleted until 2026-06-11 ("unused WS
   sendMessage handler and Socket.IO broadcast removed") — meaning both paths coexisted for roughly
   4.5 months before GraphQL became the sole message-delivery path. See [ADR 0004](ADR/0004-graphql-socketio-api-layer-split.md).
   *Why:* to get transactional guarantees around message persistence, and — per Project Motivation —
   "to learn what that kind of change actually costs in a live system, not just on paper."

3. **Deployment infrastructure** (2026-04-22 ~ 2026-05-27) — CI/CD workflow created 2026-04-22,
   Docker Compose added 2026-05-01, then a monorepo restructure (2026-05-13 ~ 2026-05-27) moved
   everything into the current `backend/`/`frontend/` workspace-package layout.
   *Why:* per Project Motivation, "didn't stop at a feature demo" — CI/CD and containerized local dev
   were added the way an actually-deployed service needs them, not as an afterthought.

4. **AI chat integration** (2026-05-29 ~) — Gemini-backed AI companion (`AiService`), first landing
   as "Update: AI Chat Bot for registered users."
   *Why:* not stated in README's Project Motivation notes — the closest documented rationale is the
   cost-capped design itself (token limits, history truncation, retry ceiling), not the decision to
   add AI chat in the first place. Flagging this gap rather than guessing at it.

5. **Admin panel + RBAC/audit system** (2026-06-16 ~ 2026-06-17) — the `admin/` workspace package,
   superadmin role tier, and audit-log system all landed within two days of each other.
   *Why:* same "not a demo" motivation as deployment infrastructure — user/room management and an
   audit trail are what a live, multi-user service actually needs, not a nice-to-have.

6. **Security incident response** (2026-06-18) — "Fix: password leak via missing serializer, stale
   role cache, RBAC bypass on audit log, admin signout method, and bind local dev server to loopback."
   Full write-up in README's [AI-Assisted Development Notes](README.md#ai-assisted-development-notes).
   *Why:* not planned work — a live incident (exposed dev port led to a ransomware bot wiping the dev
   database) that got contained, rotated, and documented end-to-end rather than quietly patched over.

7. **Transaction pattern formalization** (2026-07-02) — `GqlTransactionInterceptor` introduced,
   replacing an inline `dataSource.transaction()` call that had handled `sendMessage` until then. See
   [ADR 0003](ADR/0003-database-transaction-strategy.md).
   *Why:* per ADR 0003's Context, multi-table writes without a shared `QueryRunner` orphan partial
   state on failure — centralizing open/commit/rollback/release behind one interceptor closes that gap
   for every future multi-write mutation, not just the one that prompted it.

8. **Behavioral moderation system** (2026-07-11) — strike accrual + escalation ladder
   (warn → mute → timed ban → permanent ban). See [ADR 0006](ADR/0006-moderation-one-directional-dependency.md).
   *Why:* same "not a demo" motivation as admin/deployment — abuse prevention a live, publicly
   registrable chat app actually needs once real users can message each other unsupervised.

9. **Documentation overhaul** (2026-07-15 ~ 2026-07-20) — README rewrite, then this
   ARCHITECTURE/CONTRIBUTING/ROADMAP/CHANGELOG suite, plus an ADR set that grew from CLAUDE.md's
   original 5 decisions to 21 — each with a Korean `.ko.md` pair.
   *Why:* conventions and architecture decisions had accumulated implicitly across code comments and
   one large CLAUDE.md as the project grew past a single-file README — including gaps CLAUDE.md itself
   had (e.g. no mention of `ModerationModule` or the `admin/` workspace) — surfaced and fixed while
   building this suite rather than left to drift further.

10. **Security & observability hardening** (2026-07-18 ~ 2026-07-19) — Helmet security headers and
    `trust proxy`, IP-keyed rate limiting on `signin`/`register` (see
    [ADR 0020](ADR/0020-security-headers-and-auth-rate-limit.md)), CSP for `frontend`/`admin`, 23
    dependency vulnerabilities patched (5 high), a liveness `/health` endpoint wired into Railway's
    healthcheck, log persistence across redeploys ([ADR 0018](ADR/0018-railway-volume-log-persistence.md)),
    Sentry error tracking ([ADR 0019](ADR/0019-sentry-error-tracking.md)), and Dependabot.
    *Why:* per ADR 0019's Context, metrics, tracing, and error grouping were absent monorepo-wide —
    ADR 0018 had made logs durable, but a durable `error.logs.log` still requires someone to know to
    go look at it. The 2026-06-18 incident got contained, but nothing then in place would have
    surfaced the next one unprompted. Scope was deliberately narrowed to error tracking on the
    backend only; `frontend`/`admin` error tracking remains a deferred, separate task.

11. **Doc-integrity CI enforcement** (2026-07-18 ~ ) — `pnpm check:adr` (broken links/anchors, stale
    line citations, nearby-symbol content match, missing `.ko.md` pairs, EN/KO heading-structure
    parity), `pnpm check:config` (`MODERATION_DEFAULTS` across its 4 documented mirrors), and
    `pnpm check:deps` (README's dependency lists vs `backend/package.json`) — all wired into the
    blocking `test` job.
    *Why:* the phase-9 suite cites specific `file:line` locations throughout, and several were
    already stale within days of being written (`5759009` fixed 4 such citations in CLAUDE.md
    itself). Prose conventions don't survive a moving codebase — the accuracy claims had to become
    machine-checked or they would rot silently, which is worse than having no citation at all.

## Planned

Carried over from README's former "Scale Up In Future" section — a backlog, not a committed
timeline or priority order.

### Backend

- Last message and unread count on the conversation list — the list itself already exists
  (`getMyRooms`, `chat.service.ts`), but returns only `{ roomId, recipientId }`; what's missing is
  the last-message preview and the unread count, not the list. Scope not yet decided; likely
  direction is a per-participant "last read" timestamp, but the exact schema (column on the
  existing participants join table vs. a separate read-receipt table) is still open.
- Group chat rooms (broadcast via `roomId` to multiple participants) — `RoomEntity.participants` is
  already `@ManyToMany` so the data model supports it, but `findRoom`/`getRoom`/`createRoom`
  (`chat.service.ts`) are currently hardcoded to exactly two participants and would need a real
  redesign, not an extension. `getMyRooms` is a fourth, quieter call site: it picks the recipient as
  `participants.find(p => p.id !== userId)`, so on a 3+ participant room it would return one
  arbitrary participant rather than failing. Current direction: room creator is the only one who can
  invite new participants (no open-invite model).
- Let users delete rooms and conversation history — an admin-only `deleteRoom` mutation already
  exists (`chat.resolver.ts`, `@RBAC(UserRole.admin)`), but it hard-deletes the room for everyone;
  there is no user-facing path. Current direction for the user-facing one: if the room's creator
  deletes it, it's marked deleted for all participants; if a non-creator participant deletes it, only
  that participant leaves (the room persists for the others). Open question this raises: whether the
  existing admin hard-delete should converge on the same soft-delete mechanic or stay a distinct
  operation. Exact mechanics (schema, cascade behavior) not yet designed.
- "User is typing" indicator — direction: keep it on the GraphQL Subscription channel (same as
  `receiveMessage`) rather than adding it to Socket.IO, to stay consistent with
  [ADR 0004](ADR/0004-graphql-socketio-api-layer-split.md)'s "Socket.IO carries no chat-message
  traffic" boundary.

### Frontend

- Unread message count badge on the chat room list — the room list UI itself already renders from
  `getMyRooms` (`chat-page.tsx`); only the unread badge is missing, and it is blocked on the backend
  item above.

## Related documents

- [README.md](README.md) — current feature set
- [ARCHITECTURE.md](ARCHITECTURE.md) — system structure these items would extend
- [CHANGELOG.md](CHANGELOG.md) — full commit-by-commit record
