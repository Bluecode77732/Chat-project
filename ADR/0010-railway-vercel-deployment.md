# 0010: Railway (backend) + Vercel (frontend, admin) for deployment

## Status

Accepted

## Context

Three deployables (`backend`, `frontend`, `admin`) need hosting: one long-running Node process with a
Postgres + Redis connection, and two static/SPA React builds.

## Decision

- `backend` deploys to Railway: `railway.toml` builds `backend/Dockerfile` (multi-stage), runs
  `pnpm migration:run && node dist/main` on start, restarts on failure up to 3 times. Triggered by
  `.github/workflows/deploy.yml`'s `deploy` job on push to `main` only.
- Railway gates deploy health via `healthcheckPath = "/health"` (liveness only — no DB/Redis probe,
  to avoid a transient dependency blip forcing a restart loop on an otherwise-healthy container).
- `frontend` and `admin` each deploy to their own separate Vercel project, each with its own
  `vercel.json` (SPA rewrite only).
- **Why:** free/low-cost tiers sufficient for a personal project, plus convenient GitHub-push-to-deploy
  integration on both platforms.

## Consequences

- Two separate platforms means split observability — logs and metrics live in two different
  dashboards instead of one; there is no unified view across `backend` and the two frontends.
- Running `frontend`/`admin` as two separate Vercel projects (rather than one) doubles the CORS surface
  to maintain (`CORS_ORIGIN` must list both origins, everywhere it's set) — accepted because the two
  apps need genuinely independent deploy cadences and because the admin/frontend split itself was a
  deliberate security-boundary decision (see [0009](0009-admin-separate-app.md)).
- Never suggest moving `backend` to Vercel (its serverless model doesn't fit a long-running Socket.IO
  process with persistent Postgres/Redis connections) or moving `frontend`/`admin` to Railway without
  an explicit request — the current split matches each deployable's actual runtime shape.
