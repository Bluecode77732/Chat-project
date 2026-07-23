# 0019: Backend error tracking via Sentry (5xx only)

## Status

Accepted

## Context

An observability investigation this session confirmed metrics, tracing, and APM were all
completely absent at the application level across the whole monorepo -- no
`prom-client`/`opentelemetry`/`Sentry`-class dependency anywhere in `backend/`, `frontend/`, or
`admin/`; `/health` was liveness-only; no correlation IDs; frontend/admin had zero error
boundaries or global JS error handlers (an unhandled error in `frontend/src/pages/chat-page.tsx:410`
would vanish with no trace anywhere). [ADR 0018](0018-railway-volume-log-persistence.md) had
already fixed log *durability*, but a durable `error.logs.log` on a Railway volume still has no
search, grouping, or alerting -- someone has to know to go look.

Scope was deliberately narrowed: **error tracking only** (no metrics, no distributed
tracing/performance monitoring), **backend only** (frontend/admin explicitly deferred to a later,
separate task), **free/low-cost tier priority**, consistent with this project's existing
philosophy in [ADR 0010](0010-railway-vercel-deployment.md).

## Decision

- Tool: **Sentry**, via the official `@sentry/nestjs` package (MIT licensed, confirmed via npm;
  peer range `@nestjs/common ^8‖9‖10‖11.0.0` covers this repo's NestJS 11). Free "Developer" plan:
  5,000 error events/month, 1 user, 30-day retention.
- `backend/src/instrument.ts` (new file) calls `Sentry.init()`, guarded by
  `if (process.env.SENTRY_DSN)` (`instrument.ts:29`) -- unset means `Sentry.init()` never runs and
  every `captureException` call becomes a safe no-op (verified directly in the installed SDK's
  source, `@sentry/core`'s `Scope.captureException`: with no client configured it returns early
  without throwing or attempting network I/O). Same optional-integration shape as `MailModule`
  (`backend/src/mail/mail.service.ts:12-24`).
  - `environment: process.env.NODE_ENV`, not `ENV` (`instrument.ts:32`) -- `ENV` is `.required()`
    in the Joi schema but has zero consumers anywhere in `backend/src`; `NODE_ENV` is what actually
    drives dev/prod behavior throughout (`logger.ts:20`, `all-exceptions.filter.ts:15`, `main.ts`).
  - `sendDefaultPii` is never set (`instrument.ts`) -- a real, since-patched CVE
    (GHSA-6465-jgvq-jhgp, SDK 10.11.0-10.26.0) leaked `Authorization`/`Cookie` headers through that
    flag. `@sentry/nestjs` is pinned `^10.66.0`, well above the fixed floor of `10.27.0`.
  - `tracesSampleRate: 0` (`instrument.ts:34`) -- performance monitoring is out of scope.
  - A `beforeSend` hook (`instrument.ts:35-51`) recursively scrubs `password`/`token`/
    `secret`-named fields from request data, extra context, and breadcrumbs before an event leaves
    the process -- defense-in-depth beyond Sentry's own header/cookie denylist, which doesn't cover
    arbitrary body fields, enforcing this repo's existing "never log sensitive fields" rule for
    this new egress path (Sentry is third-party SaaS, unlike the winston logs which stay on the
    Railway volume per ADR 0018).
- `backend/src/main.ts:1` imports `./instrument` as the literal first line, before `NestFactory` --
  load-bearing per Sentry's docs, since its auto-instrumentation patches modules that must not
  already be loaded by the time `Sentry.init()` runs.
- `backend/src/app.module.ts:73` adds `SentryModule.forRoot()` to `imports` (from
  `@sentry/nestjs/setup`), and `:62` adds `SENTRY_DSN: Joi.string().optional()` to the Joi schema,
  following the exact `SMTP_HOST` precedent already in the same schema.
- `backend/src/base/filter/all-exceptions.filter.ts:56-58` adds one manual
  `Sentry.captureException(exception, { extra: { stack, isGraphQL } })` call, gated on
  `Number(status) >= 500` -- the same condition the filter already computes at `:51` for
  `logger[level]`.
- **Rejected: Sentry's own `@SentryExceptionCaptured()` decorator.** Sentry's NestJS docs recommend
  it for apps with an existing global catch-all filter (instead of swapping in
  `SentryGlobalFilter`), but its default behavior does not capture `HttpException` instances --
  confirmed via Sentry's own GitHub issue tracker (`getsentry/sentry-javascript#14580`, `#13064`).
  This breaks two real paths in this codebase:
  1. **Under-reports real 500s**: `InternalServerErrorException` (an `HttpException` subclass) is
     thrown at `backend/src/chat/interceptor/gql-transaction.interceptor.ts:74` (a rolled-back chat
     transaction) and `backend/src/chat/decorator/gql-query-runner.decorator.ts:21`. Under the
     decorator's default, neither would ever reach Sentry.
  2. **Over-reports an intentional 4xx**: `all-exceptions.filter.ts`'s `isPayloadTooLarge` branch
     maps a raw (non-`HttpException`) body-parser error to a benign 413. The decorator's default
     would still flag this as unexpected, burning quota on ordinary oversized uploads.
  Manual capture, gated on the filter's own existing status check, avoids both failure modes and
  reuses existing logic instead of introducing a second, divergent notion of "is this bad."
- Alternatives considered and rejected: a self-hosted or managed metrics/tracing stack
  (Prometheus/Grafana, OpenTelemetry + a collector) -- disproportionate to a solo-developer,
  free-tier-priority project (per ADR 0010); deferred entirely, not just narrowed, unlike this
  error-tracking decision.

## Consequences

- 5,000 events/month is a hard ceiling on the free tier -- ordinary traffic should rarely approach
  it (only real 5xx count, not 4xx), but a repeating-5xx incident left unnoticed could burn through
  it within hours, silently dropping further events for the rest of the billing cycle (no charge,
  no crash -- just invisible after the cap).
- `SENTRY_DSN` is read directly via `process.env`, not through the Joi-validated `ConfigService`
  (`backend/src/app.module.ts`) at the point it's consumed in `instrument.ts` -- the SDK must
  initialize before Nest's DI container exists, same reasoning ADR 0018 established for
  `RAILWAY_VOLUME_MOUNT_PATH`.
- Obtaining a DSN is a one-time manual step (Sentry account + project, external to this repo) --
  same "you do this, not me" framing as the Railway volume in ADR 0018. Local dev/CI need nothing;
  the integration no-ops without a DSN.
- **frontend/admin still have zero error visibility** -- an unhandled JS error there still vanishes
  today. Deferred as a separate, later task by explicit scope decision, not an oversight.
- Metrics and distributed tracing remain completely absent. This ADR does not change that; see
  CLAUDE.md's Observability advisory for the standing policy on those two.
