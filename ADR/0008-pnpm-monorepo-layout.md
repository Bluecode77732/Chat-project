# 0008: pnpm workspace monorepo (backend/frontend/admin)

## Status

Accepted

## Context

The project ended up needing three deployables that share one GraphQL contract: the NestJS backend,
the chat frontend, and (later) a separate admin dashboard (see [0009](0009-admin-separate-app.md)).
Each could have lived in its own repository, or all three could share one repo.

## Decision

- One repository, one root `pnpm-lock.yaml`, three workspace packages declared in
  `pnpm-workspace.yaml`: `backend`, `frontend`, `admin`.
- Root-level scripts (`package.json`) proxy to `backend` only (`pnpm build` → `pnpm --filter backend
  build`, etc.) — `frontend`/`admin` are run directly inside their own directories.
- **Why:** solo-project scale — one developer maintaining three packages that share a GraphQL contract
  makes monorepo overhead lower than coordinating three separate repos and keeping their contracts in
  sync by hand (per the developer: "1인 프로젝트 규모에 적합하고, 관리가 편리하며, 관리 비용이 적음" —
  "fits a one-person project's scale, is convenient to manage, and keeps management cost low").
- Alternatives considered and rejected:
  - **Three separate repositories** (polyrepo), one per package: rejected — would require manually
    keeping `schema.gql` and the GraphQL client operations that depend on it in sync across repo
    boundaries, and versioning/publishing any code the packages needed to share, all coordination
    overhead a single developer gets no benefit from at this scale.

## Consequences

- A single root lockfile couples all three packages' dependency resolution — a version bump in one
  package's dependency tree can shift what pnpm resolves for another, even though they don't share
  runtime code.
- CI (`.github/workflows/deploy.yml`) does not filter jobs by changed path — every push runs both
  `backend` lint+test and the `admin-e2e` job regardless of which package actually changed. Acceptable
  at current scale; would need Nx/Turborepo-style affected-package filtering if the team or package
  count grew.
- Never suggest splitting `backend`/`frontend`/`admin` into separate repositories without an explicit
  request — that reopens the exact coordination cost (keeping `schema.gql` and client operations in
  sync across repos, versioning a shared package) this layout was chosen to avoid.
- Adding a fourth workspace package (e.g. a future mobile client) should default to adding it to this
  same `pnpm-workspace.yaml` rather than starting a new repository, unless its build/deploy needs are
  genuinely incompatible with the pnpm workspace model.
