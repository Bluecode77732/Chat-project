# 0018: Persist logs across Railway redeploys via an attached volume

## Status

Accepted

## Context

`backend/src/base/logger/logger.ts` writes winston logs via `winston.transports.File` to a local
directory. Railway's container filesystem is ephemeral -- every redeploy/restart wipes it, so
`error.logs.log` (where `AllExceptionsFilter` routes every 5xx via
`level = Number(status) >= 500 ? 'error' : 'warn'`, `backend/src/base/filter/all-exceptions.filter.ts:50`)
was effectively write-only: useless for post-incident investigation, even though the winston setup
and the filter itself were otherwise working correctly.

The same file also had a `const isVercel = process.env.VERCEL === '1'` branch gating the `File`
transports off when true. This was confirmed dead in every real deployment: `VERCEL` appears
nowhere else in the repo, `railway.toml` predates the branch by roughly three weeks, and
[0010](0010-railway-vercel-deployment.md) already establishes backend as Railway-only -- Railway
never sets `process.env.VERCEL`, so `!isVercel` was always `true` in production.

Full metrics/tracing/APM adoption was explicitly out of scope for this fix -- narrowly, "make the
existing error log durable across redeploys."

## Decision

- Attach a Railway persistent Volume to the backend service (dashboard, or
  `railway volume add --mount-path /data` via CLI). Railway has no config-as-code representation
  for volumes -- confirmed against `docs.railway.com/reference/config-as-code`,
  `docs.railway.com/volumes/reference`, `docs.railway.com/volumes`, and `docs.railway.com/cli/volume`
  -- so the volume resource must be provisioned out-of-band; nothing changes in `railway.toml`.
- `logger.ts` reads the mount path from `RAILWAY_VOLUME_MOUNT_PATH` (auto-injected by Railway once
  a volume is attached, at container start), falling back to the previous
  `join(process.cwd(), 'logs')` when unset -- local dev, CI, or a Railway service with no volume
  attached -- so behavior off Railway is unchanged (`backend/src/base/logger/logger.ts:26-28`).
- Removed the dead `isVercel` branch; both `File` transports now construct unconditionally,
  pointed at the resolved `logDir` (`backend/src/base/logger/logger.ts:50,61`).
- Alternatives considered and rejected:
  - **External log-drain service** (e.g. Better Stack): rejected to avoid a new npm dependency, a
    new external account, and third-party transmission of log content, when Railway's own infra
    already offers a first-party durability mechanism for the same problem.
  - **Mail alert on 5xx via the existing `MailModule`**: rejected because it solves notification,
    not retention -- it doesn't let anyone look back at pre-incident log history after a redeploy,
    which was the actual goal.

## Consequences

- Railway ties a volume to a single non-replicated instance. If the backend is ever scaled to
  multiple Railway replicas, per-instance log files on one shared volume will need revisiting --
  not a blocker today, since the backend runs as a single instance and its existing
  horizontal-scaling story (the Socket.IO Redis adapter) is unrelated to file logging.
- `RAILWAY_VOLUME_MOUNT_PATH` is read directly via `process.env`, not through the Joi-validated
  `ConfigService` schema (`backend/src/app.module.ts`) -- consistent with this file's pre-existing
  direct-`process.env` reads of `LOG_LEVEL`/`NODE_ENV`, since winston's singleton is constructed at
  module-load time, before Nest's DI container exists.
- Provisioning the volume is a one-time manual step (dashboard or CLI) outside this repo's git
  history -- a fresh clone/deploy without that step silently falls back to the old ephemeral
  behavior rather than failing loudly. Anyone standing up a new Railway environment for this
  backend must remember to attach a volume.
- If the container process lacks write permission on the mounted path, winston's `File` transport
  emits an `error` event rather than throwing -- file logging could silently stop while Console
  output keeps working. Worth checking after the first deploy, not an ongoing concern.