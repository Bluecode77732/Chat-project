# Contributing

This is the entry point for contributing changes to this repo — setup, branch model, commit
convention, and PR checklist. README's Quick Start covers running the app locally; it doesn't cover
the workflow for submitting a change. CLAUDE.md already documents deep code-level conventions (Never
Do rules, testing patterns, transaction boundaries) in detail — this file doesn't restate those, it's
the on-ramp that gets a new contributor to the point of opening a PR, pointing to CLAUDE.md for what
happens after that.

## Prerequisites

- Node.js `24.x` (pinned in `.nvmrc` and root `package.json`'s `engines`)
- pnpm `>=10` (`packageManager: pnpm@10.33.0` is pinned in root `package.json`; CI installs this exact
  version via `pnpm/action-setup`)
- Docker + Docker Compose, if you want the full local stack (Postgres + Redis + backend) instead of
  running services individually

## Setup

```bash
pnpm install   # installs all three workspace packages: backend/, frontend/, admin/
```

**backend**: copy `backend/.env.example` to `backend/.env` and fill in the values — every var is
validated at startup via Joi (`app.module.ts`), so a missing one fails fast rather than silently.

**frontend / admin**: copy each package's `.env.example` to `.env.local` and adjust if your backend
runs somewhere other than `localhost:3000`:
```bash
cp frontend/.env.example frontend/.env.local
cp admin/.env.example admin/.env.local
```

## Running locally

**Full stack via Docker** (recommended for backend work — matches production's migrate-then-start
sequence):
```bash
docker compose up -d --build   # requires .env.local at the project root
docker compose down -v         # tear down
```

**Per-package, without Docker**:
```bash
cd backend && pnpm start:dev   # NODE_ENV=development, binds 127.0.0.1:3000
cd frontend && pnpm dev        # Vite dev server, :5173
cd admin && pnpm dev           # Vite dev server, :5174
```

## Branch model

- `main` — the deploy branch. `.github/workflows/deploy.yml`'s `deploy` job triggers only on push to
  `main`, building and pushing to Railway.
- `dev` — active development branch.

(Other branches you may see in the remote, such as `dev1` or the auto-generated
`railway/code-change-*` branches, are not part of the documented workflow here — check with a
maintainer before branching from them.)

## Commit convention

Recent history uses a `Prefix: description` style — a capitalized word, colon, then a short
description. Going forward, use one of:

`Fix:` `Feat:` `Add:` `Docs:` `Refactor:` `Test:` `Chore:` `Harden:` `Remove:` `Style:` `Logging:` `CI:`

Note: this convention has **not** been applied consistently across the project's full history (casing
and prefix vocabulary vary a lot in older commits) — `CHANGELOG.md` reflects that history literally
rather than pretending otherwise. New commits should follow the list above.

## Before submitting a PR

CI (`.github/workflows/deploy.yml`) runs on every PR to `main`:

| Job | What it does | Blocking? |
|---|---|---|
| `test` (ubuntu-latest) | `pnpm --filter backend lint` (non-blocking, `\|\| true`), `pnpm --filter backend test`, `pnpm --filter admin lint` (non-blocking), `pnpm --filter admin test` | Yes |
| `test` (windows-latest) | same steps | No — `continue-on-error: true` for this OS in the matrix |
| `e2e` | backend jest e2e boot smoke test, then Playwright e2e against `frontend/` — both against real Postgres 16 + Redis 7 service containers | Yes — blocks `deploy` (listed in its `needs`) |
| `admin-e2e` | seeds a superadmin, runs Playwright e2e against `admin/` | No — `continue-on-error: true`; kept out of `deploy`'s `needs` until a successful run in the real GitHub Actions environment is confirmed via this workflow's run history (not just local YAML/unit-test validation) |

Locally, before opening a PR:
```bash
cd backend
pnpm lint          # ESLint --fix
pnpm format        # Prettier
pnpm test          # Jest unit tests
pnpm test:e2e       # backend e2e (test/app.e2e-spec.ts)
```

Code style is enforced by `backend/.prettierrc` (`singleQuote: true`, `trailingComma: "all"`) and
ESLint (`backend/eslint.config.mjs`). Beyond formatting, this project follows a set of stricter
by-convention rules (no `any`, no floating promises, no empty `catch`, transaction boundaries via
`GqlTransactionInterceptor`, etc.) documented in [CLAUDE.md](CLAUDE.md#never-do--forbidden-patterns) —
read that before touching backend code, especially anything under `app.module.ts`, `*.entity.ts`,
`*.interceptor.ts`, or `backend/src/schema.gql`, which require explicit approval for changes per
CLAUDE.md's Scope Discipline.

## Testing conventions

- Tests live alongside source as `*.spec.ts`; only services and the Redis module are measured for
  coverage (`backend/package.json`'s `coveragePathIgnorePatterns` excludes controllers, guards,
  gateways, resolvers, interceptors, DTOs, entities, etc. — this is a deliberate policy, not a gap).
- `bcrypt` is mocked globally via `backend/src/mocks/bcrypt.ts`.
- Mock repositories rather than hitting a real DB — see the pattern in
  [CLAUDE.md's Testing section](CLAUDE.md#testing).
- `frontend/e2e/` and `admin/e2e/` hold their own Playwright suites, run independently in CI.

## Reporting issues

There's no issue template configured yet — open a GitHub issue with a clear repro/description. For
anything security-related, see CLAUDE.md's
[Incident Response](CLAUDE.md#incident-response) section for how this project's AI-assisted workflow
handles suspected compromises.
