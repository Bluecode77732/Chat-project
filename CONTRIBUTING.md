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
docker compose up -d --build   # requires .env.docker at the project root
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

Open the PR against `main`. `.github/workflows/deploy.yml`'s `pull_request` trigger is scoped to
`branches: [main]`, so a PR targeting `dev` — or any other branch — runs **no CI at all**. Use the
same `Prefix: description` convention as commits for the PR title. There is no PR template and no
required-reviewer rule configured; the CI jobs below are the gate.

CI (`.github/workflows/deploy.yml`) runs on every PR to `main`:

| Job | What it does | Blocking? |
|---|---|---|
| `test` (ubuntu-latest) | `pnpm --filter backend lint`, `pnpm --filter backend test`, `pnpm --filter admin lint`, `pnpm --filter admin test`, `pnpm check:adr`, `pnpm check:config`, `pnpm check:deps`, `pnpm check:changelog` — no step has a `\|\| true` fallback, so any failure hard-fails the job | Yes |
| `test` (windows-latest) | same steps | No — `continue-on-error: true` for this OS in the matrix |
| `e2e` | backend jest e2e boot smoke test, then Playwright e2e against `frontend/` — both against real Postgres 16 + Redis 7 service containers | Yes — blocks `deploy` (listed in its `needs`) |
| `admin-e2e` | seeds a superadmin, runs Playwright e2e against `admin/` | No — `continue-on-error: true`; kept out of `deploy`'s `needs` until a successful run in the real GitHub Actions environment is confirmed via this workflow's run history (not just local YAML/unit-test validation) |

The last four `test` steps are documentation-integrity checks, and they fail the build exactly like
a test does: `check:adr` (broken ADR links/anchors, stale `file:line` citations, missing `.ko.md`
pairs, EN/KO heading parity), `check:config` (`MODERATION_DEFAULTS` in sync across its documented
mirrors), `check:deps` (README's dependency lists vs `backend/package.json`), `check:changelog`
(`CHANGELOG.md`/`.ko.md` list every commit in `git log`, under the right date heading).

`check:changelog` tolerates exactly **one** unrecorded newest commit — the one doing the recording.
So a single commit needs no changelog edit, but stacking a second on top makes the first one fail:
when a PR carries more than one commit, add each commit's own subject line to both `CHANGELOG.md` and
`CHANGELOG.ko.md` (verbatim, English subject in both files) as part of that commit.

> Note: CI's `e2e`/`admin-e2e` run against `postgres:16` service containers, while local Docker
> (`docker-compose.yml`) and the documented local prerequisite use `postgres:18` — an intentional
> environment difference, not a drift.

Locally, before opening a PR — run everything the blocking `test` job runs, not just the backend
half, or the other six steps will fail in CI first:
```bash
cd backend
pnpm lint          # ESLint --fix
pnpm format        # Prettier
pnpm test          # Jest unit tests
pnpm test:e2e      # backend e2e (test/app.e2e-spec.ts)

cd ..              # the rest run from the repo root
pnpm --filter admin lint
pnpm --filter admin test
pnpm check:adr && pnpm check:config && pnpm check:deps && pnpm check:changelog
```

`frontend/`'s vitest suite is the one exception: it has no CI step today (only `admin/`'s does), so
`pnpm --filter frontend test` will not be run for you — run it locally when touching `frontend/src`.

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
- `admin/` (vitest, 14 specs) and `frontend/` (vitest, 21 specs) both have unit test coverage now,
  same setup (`src/test/setup.ts`, same devDependency versions). `frontend/`'s suite ports admin's
  three files (axios/protected-route/auth.store, adapted for its simpler no-role auth model) plus a
  new one for `session-guard.ts` -- the in-flight refresh dedup and cross-tab conflict-detection logic
  had no test in either app despite being the most race-condition-sensitive piece of auth code (see
  CLAUDE.md's Session Guard section).
- `backend/test/app.e2e-spec.ts` builds its app via `Test.createTestingModule({ imports: [AppModule] })`
  + `createNestApplication()` + `app.init()` -- it never runs `main.ts`'s `bootstrap()`, so `cookieParser()`,
  `helmet()`, the global `ValidationPipe`, and `AllExceptionsFilter` are not wired up for these tests.
  Left as-is rather than fixed: its four cases were each picked specifically because they don't depend
  on any of that (routing plus guard/service-level `HttpException`s only). Exercising `main.ts`'s
  middleware stack in e2e would require extracting it into a function shared between `bootstrap()` and
  the test's `createNestApplication()` call -- a larger refactor, not done here.
- `frontend/` and `admin/` have no React error boundary and no global `window.onerror`/
  `unhandledrejection` handler -- an unexpected error (e.g. `frontend/src/pages/chat-page.tsx:410`'s
  rethrow for anything other than a known `TOO_MANY_REQUESTS`/`FORBIDDEN` GraphQL error) vanishes with
  no trace anywhere today. No test catches this because there's no boundary/handler in production code
  to test in the first place. Deliberately deferred alongside [ADR 0019](ADR/0019-sentry-error-tracking.md)'s
  backend-only Sentry integration -- backend error tracking was the higher-priority half of that
  decision. Pick this up by adding `@sentry/react` (mirroring the backend's `@sentry/nestjs` setup)
  with a top-level error boundary in both apps' `main.tsx`, plus wiring `errorLink`'s currently-silent
  non-auth branch (`frontend/src/api/apollo.ts`, `admin/src/api/apollo.ts`) to report as well.

## Reporting issues

The only issue template configured is `.github/ISSUE_TEMPLATE/architecture-completeness-sweep.md`,
which drives the periodic documentation-gap review — there's no general bug/feature template yet, so
for anything else open a plain GitHub issue with a clear repro/description. For
anything security-related, see CLAUDE.md's
[Incident Response](CLAUDE.md#incident-response) section for how this project's AI-assisted workflow
handles suspected compromises.
