# Architecture Decision Records

> 한국어 버전: [README.ko.md](README.ko.md)

This directory formalizes the decisions already summarized in
[CLAUDE.md's Architecture Decisions section](../CLAUDE.md#architecture-decisions) as individual,
citable records. CLAUDE.md remains the source of truth for AI-agent behavior ("never suggest X"); these
files exist so each decision has its own context/rationale trail without bloating CLAUDE.md itself.

## Format

Each ADR follows a lightweight structure: **Status**, **Context** (the problem/constraint), **Decision**
(what was chosen), **Consequences** (what that commits you to, including what NOT to suggest instead).
Each ADR has a Korean translation at the same number with a `.ko.md` suffix (e.g.
[0001-jwt-auth-token-strategy.ko.md](0001-jwt-auth-token-strategy.ko.md)).

Citations to source use backtick-quoted `file.ts:NN` (a single line, a range `NN-MM`, or a
comma-separated list `NN,MM,KK`). Name the specific symbol or call being cited in backticks near the
citation (this is already the prevailing style, not a new requirement) -- `scripts/check-adr-integrity.mjs`
(`pnpm check:adr`) cross-checks that a nearby symbol actually appears at the cited location and warns
(never fails the build) when none do, since it is a heuristic and can false-positive on a citation that
only names its enclosing class. Existence/range errors on citations (missing file, out-of-bounds line)
do fail the build. See the script's own header comment for why a plain existence check was not enough --
it was built after a stale citation slipped past one twice in the same session.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-jwt-auth-token-strategy.md) | JWT access/refresh token split | Accepted |
| [0002](0002-redis-cache-conventions.md) | Redis cache key/TTL conventions via ioredis | Accepted |
| [0003](0003-database-transaction-strategy.md) | PostgreSQL + TypeORM transaction strategy | Accepted |
| [0004](0004-graphql-socketio-api-layer-split.md) | GraphQL for data, Socket.IO for connection lifecycle only | Accepted |
| [0005](0005-cors-multi-origin-policy.md) | CORS multi-origin allowlist via one env var | Accepted |
| [0006](0006-moderation-one-directional-dependency.md) | ModerationModule's one-directional dependency | Accepted |
| [0007](0007-ai-reply-distributed-lock.md) | Per-room distributed lock for AI reply generation | Accepted |
| [0008](0008-pnpm-monorepo-layout.md) | pnpm workspace monorepo (backend/frontend/admin) | Accepted |
| [0009](0009-admin-separate-app.md) | Admin dashboard as a fully separate app, not a route in `frontend` | Accepted |
| [0010](0010-railway-vercel-deployment.md) | Railway (backend) + Vercel (frontend, admin) for deployment | Accepted |
| [0011](0011-gemini-ai-provider.md) | Google Gemini as the AI reply provider | Accepted |
| [0012](0012-airoomentity-split.md) | `AiRoomEntity` split out of `RoomEntity` | Accepted |
| [0013](0013-local-dev-network-binding.md) | Local dev services bind to 127.0.0.1 only, with Redis auth | Accepted |
| [0014](0014-single-active-session.md) | Single active session per user (auto-evict prior socket) | Accepted |
| [0015](0015-audit-trail-privileged-actions.md) | Audit trail for every privileged/enforcement action | Accepted |
| [0016](0016-redis-unavailability-policy.md) | Redis unavailability: fail closed for security checks, degrade to DB for caches | Accepted |
| [0017](0017-auth-user-chat-circular-dependency.md) | AuthModule ↔ UserModule ↔ ChatModule circular dependency via forwardRef | Accepted |

Scope note: 0001–0005 formalize decisions already stated in CLAUDE.md; 0006–0007 formalize code-level
rationale that previously existed only as inline comments at their source file. 0008, 0010, 0012, 0013
extend coverage to decisions previously documented only in ARCHITECTURE.md or README.md; 0014–0015
formalize rationale already stated in CLAUDE.md's Project-Specific Principles. 0009 and 0011 required a
fresh interview with the developer — the admin-app split's motivation and the Gemini choice's
motivation were not recorded anywhere in code or prior docs before this pass. 0016 formalizes a policy
decided and implemented during a follow-up gap review of the ADR set itself — three Redis call sites
(JWT blacklist check, user_cache read/write, mute check) previously had no error handling at all, unlike
the pre-existing RateLimitGuard; the fix and the ADR were done together, not documentation-only. 0017
covers a related finding from the same gap review — a bootstrap-order circular dependency between
AuthModule, UserModule, and ChatModule — assessed as low severity and left as-is, documented rather
than refactored.
motivation were not recorded anywhere in code or prior docs before this pass.
