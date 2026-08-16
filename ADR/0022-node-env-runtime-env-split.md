# 0022: Split NODE_ENV (standard) from RUNTIME_ENV (native|docker)

## Status

Accepted

## Context

`NODE_ENV` previously carried a non-standard third value, `'docker'`, alongside the standard
`development`/`production` (`test` was implicitly supported by Jest's default behavior but never
set by docker-compose). This overloaded a single variable with three unrelated questions at once:
`envFilePath` selection (`app.module.ts:72-77`, which `.env*` file to load), HTTP host binding
(`main.ts:103-111`, `127.0.0.1` vs `0.0.0.0`), and deployment-stage signaling for Sentry's
`environment` tag (`instrument.ts:32`), Winston's log level (`logger.ts:18-20`, `debug` unless
production), and stack-trace exposure in error responses (`all-exceptions.filter.ts:15`,
`isDev = NODE_ENV !== 'production'`).

The root-level `.env.local` file (the docker-compose stack's secrets file, git-ignored) also
repurposed dotenv-flow's conventional name — normally "a git-ignored local override applied on top
of any environment" — to instead mean "docker-compose's env file specifically," colliding with
`envFilePath`'s own three-way switch and confusing to anyone expecting the standard meaning.

Naively aligning with convention by picking either standard value for docker-compose breaks
something else:
- Setting `NODE_ENV=development` for docker-compose (matching "it's just local dev, containerized")
  would make `main.ts`'s old `NODE_ENV === 'development' ? '127.0.0.1' : '0.0.0.0'` bind the
  container's listener to loopback-only, making the mapped port unreachable from outside the
  container network.
- Setting `NODE_ENV=production` for docker-compose (matching "it runs the same production-target
  Dockerfile build Railway uses") would tag local docker-compose test errors as `production` in
  Sentry, indistinguishable from real production incidents, and flip log level/stack-trace exposure
  to production behavior during local debugging.

`NODE_ENV=docker` happened to sit at the one point that avoided both problems, because
`main.ts`'s check was `=== 'development'` with an implicit else, not a literal `'docker'` match —
but this was incidental, not a designed guarantee, and every `NODE_ENV` consumer had to be read
carefully to confirm it.

## Decision

- `NODE_ENV` is restricted to the three standard values (`development`, `test`, `production`)
  project-wide. It continues to drive Sentry's `environment` tag (`instrument.ts:32`), Winston log
  level (`logger.ts:18-20`), and stack-trace exposure in both HTTP and GraphQL error responses
  (`all-exceptions.filter.ts:15`) — unchanged except the literal `'docker'` branch is gone.
- A new var, `RUNTIME_ENV` (`native` | `docker`), answers only "is this process running inside the
  docker-compose local stack." Unset/absent means `native` — this covers bare `pnpm start:dev` /
  `start:prod` and Railway production, since Railway never sets it.
- `envFilePath` selection (`app.module.ts:72-77`) now keys on `RUNTIME_ENV` first:
  `RUNTIME_ENV === 'docker'` → `.env.docker`; else `NODE_ENV === 'production'` → `.env.production`;
  else → `.env`. This decouples "which env file" from NODE_ENV's former docker hack.
- Host binding (`main.ts:103-111`) restricts to `127.0.0.1` only when `NODE_ENV === 'development'
  AND RUNTIME_ENV !== 'docker'` — i.e. truly bare local dev. Everything else (docker locally,
  Railway production) binds `0.0.0.0`. This is necessary precisely because `docker-compose.yml` now
  sets `NODE_ENV=development` (next bullet) — without the added `RUNTIME_ENV` check, the container's
  port would incorrectly try to bind loopback-only and become unreachable.
- `docker-compose.yml`'s `chat` service sets `NODE_ENV: development` + `RUNTIME_ENV: docker`
  (`docker-compose.yml:21-23`), and all three `env_file:` entries (`chat`, `postgres`, `redis`)
  point at `.env.docker` instead of `.env.local` (`docker-compose.yml:16, 29, 55`). Setting
  `NODE_ENV=development` here (not `production`) is deliberate: it makes local docker runs behave
  identically to bare local dev for logging/Sentry/error-detail purposes, avoiding the Sentry
  mistagging problem above. `RUNTIME_ENV=docker` alone now drives the file-selection and
  host-binding differences.
- The root-level `.env.local` file (docker-compose's secrets file, git-ignored) is renamed to
  `.env.docker` everywhere it's referenced, including the TypeORM CLI's dotenv bootstrap
  (`data-source.ts:8`) — a path-only rename; its fallback-to-plain-`.env` chain (`override: false`
  on both calls) is unchanged.
- Alternatives considered and rejected:
  - **Keep `NODE_ENV=docker` and only rename `.env.local` → `.env.docker`**: rejected — every
    `NODE_ENV` consumer (Sentry tag, log level, stack-trace exposure) still has to special-case a
    fourth, non-standard value, and the coincidental host-binding safety noted in Context remains
    undocumented and fragile to a future edit of `main.ts`.
  - **Set `NODE_ENV=production` in docker-compose**: rejected as the dealbreaker described in
    Context — it would mistag local docker-compose test errors as production incidents in Sentry.
  - **Derive "is this docker" from an existing Railway-injected var's absence** (e.g.
    `RAILWAY_VOLUME_MOUNT_PATH`, see [ADR 0018](0018-railway-volume-log-persistence.md)) instead of
    adding `RUNTIME_ENV`: rejected — this defines "docker" as "not Railway," which conflates it with
    "not production" and breaks the moment a third native-but-non-Railway deployment target appears.
    An explicit opt-in var is clearer and doesn't depend on another platform's env var staying
    stable.

## Consequences

- `RUNTIME_ENV` must be added to `docker-compose.yml`'s `chat` service `environment:` block for any
  new local-only behavior that needs to distinguish "docker" from "bare local dev" going forward —
  do not reach for `NODE_ENV` for that purpose again.
- `envFilePath` and host-binding logic in `app.module.ts`/`main.ts` must both be updated together if
  this var scheme changes again — they're the two places that read `RUNTIME_ENV`.
- [ADR 0013](0013-local-dev-network-binding.md) predates this split and previously cited
  `NODE_ENV=docker`; it now cross-references this ADR instead of re-describing the mechanism.
- `.env.local` no longer means anything project-specific in this repo — if reintroduced, it should
  only take dotenv-flow's conventional meaning (a local override), not be repurposed again for a
  deployment-topology role.
