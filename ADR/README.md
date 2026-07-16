# Architecture Decision Records

This directory formalizes the decisions already summarized in
[CLAUDE.md's Architecture Decisions section](../CLAUDE.md#architecture-decisions) as individual,
citable records. CLAUDE.md remains the source of truth for AI-agent behavior ("never suggest X"); these
files exist so each decision has its own context/rationale trail without bloating CLAUDE.md itself.

## Format

Each ADR follows a lightweight structure: **Status**, **Context** (the problem/constraint), **Decision**
(what was chosen), **Consequences** (what that commits you to, including what NOT to suggest instead).

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

Scope note: 0001–0005 formalize decisions already stated in CLAUDE.md; 0006–0007 formalize code-level
rationale that previously existed only as inline comments at their source file. Further code-level
decisions (e.g. Single Active Session Enforcement / `forceLogout`, the audit-log requirement for
privileged actions) remain inline-only in CLAUDE.md's Project-Specific Principles for now — promote
them here as they come up.
