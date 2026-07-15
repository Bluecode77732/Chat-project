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

Scope note: this first pass covers exactly the five decisions already in CLAUDE.md. Additional
code-level rationale not yet promoted to an ADR (e.g. the `ModerationModule` one-directional dependency,
the per-room AI-reply distributed lock) lives as inline comments at its source file for now.
