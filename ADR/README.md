# Architecture Decision Records

> 한국어 버전: [README.ko.md](README.ko.md)

This directory formalizes the decisions already summarized in
[CLAUDE.md's Architecture Decisions section](../CLAUDE.md#architecture-decisions) as individual,
citable records. CLAUDE.md remains the source of truth for AI-agent behavior ("never suggest X"); these
files exist so each decision has its own context/rationale trail without bloating CLAUDE.md itself.

## Format

Each ADR follows the same four sections: **Status**, **Context** (the problem/constraint), **Decision**
(what was chosen, plus an "Alternatives considered and rejected" block naming what else was on the table
and why it lost), **Consequences** (what that commits you to, including what NOT to suggest instead).
Each ADR has a Korean translation at the same number with a `.ko.md` suffix (e.g.
[0001-jwt-auth-token-strategy.ko.md](0001-jwt-auth-token-strategy.ko.md)).

These are **not** minimal Nygard-style one-pagers, and the format shouldn't be described as
"lightweight": records here run 40-90 lines because they carry file:line citations, explicit rejected
alternatives, and "never suggest X" guardrails aimed at AI agents as much as at humans. That verbosity is
the deliberate tradeoff — the same detail that makes a record long is what makes it verifiable by
`pnpm check:adr` and directly actionable for an agent reading it cold.

Citations to source use backtick-quoted `file.ts:NN` (a single line, a range `NN-MM`, or a
comma-separated list `NN,MM,KK`). Name the specific symbol or call being cited in backticks near the
citation (this is already the prevailing style, not a new requirement) -- `scripts/check-adr-integrity.mjs`
(`pnpm check:adr`) cross-checks that a nearby symbol actually appears at the cited location and warns
(never fails the build) when none do, since it is a heuristic and can false-positive on a citation that
only names its enclosing class. Existence/range errors on citations (missing file, out-of-bounds line)
do fail the build. See the script's own header comment for why a plain existence check was not enough --
it was built after a stale citation slipped past one twice in the same session.

The same script also fails the build on two number-consistency errors, across `ADR/`, `CLAUDE.md`, and
`ARCHITECTURE.md`/`.ko.md`: an ADR link whose text and path disagree (`[ADR 0016](0007-....md)` -- the
usual cause is copying a link and editing only one half), and an ADR whose filename number disagrees
with its own `# NNNN:` heading. Both checks are verified by deliberately injecting each failure and
confirming it is caught, rather than trusting a clean run.

## Status lifecycle

Every record here is currently `Accepted`, and no decision has been reversed yet — so the procedure
below is written in advance rather than derived from a case that already happened.

- **`Accepted`** — the decision is in force and the code reflects it.
- **`Superseded by NNNN`** — a later ADR replaced this decision. **Never rewrite an existing ADR's
  Decision to reflect a reversal.** Write a new ADR that states the new decision and links back to the
  old number, then change only the old record's Status line to `Superseded by NNNN` and add the same
  link. The superseded file otherwise stays exactly as it was — the point of the record is that it
  captures what was believed at the time, and editing that away destroys the history the file exists for.
- **`Deprecated`** — the decision no longer applies but nothing replaced it (e.g. the feature it governed
  was removed). Same rule: change the Status line, leave the body intact.

A reversal therefore always produces two file edits (new ADR + old Status line) in both `.md` and
`.ko.md`, and both index tables need their Status column updated to match.

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
| [0018](0018-railway-volume-log-persistence.md) | Persist logs across Railway redeploys via an attached volume | Accepted |
| [0019](0019-sentry-error-tracking.md) | Backend error tracking via Sentry (5xx only) | Accepted |
| [0020](0020-security-headers-and-auth-rate-limit.md) | Security headers split (Helmet backend / CSP frontend+admin) and IP-based auth rate limiting | Accepted |
| [0021](0021-unified-message-delivery-channel.md) | Single delivery channel/shape for human, AI, and moderation system messages | Accepted |

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
than refactored. 0018 covers a follow-up fix found during a durability review of this backend's error logging -- the log-durability gap and the removal of a stale, dead `isVercel` branch were addressed together, not documentation-only. 0019 followed from the same observability review that produced 0018 -- confirming metrics/tracing/APM were entirely absent -- but scoped down to backend-only error tracking (Sentry) after explicit user narrowing; metrics, tracing, and frontend/admin coverage remain deferred. 0020 and 0021 came from a full-project audit cross-checking every ADR against the current implementation: 0020 formalizes a security-header/rate-limit design that existed only as a one-line README bullet, and 0021 promotes a CLAUDE.md principle (originally scoped to AI replies only) to an ADR now that a second real implementation (moderation system messages) exists.
