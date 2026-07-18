# 0005: CORS multi-origin allowlist via one env var

## Status

Accepted

## Context

Two separate frontend deployments (`frontend/`, the chat client, and `admin/`, the management
dashboard) each run on their own origin and both need to send the httpOnly `refreshToken` cookie
cross-origin, which requires `credentials: true` plus an exact origin allowlist — `origin: '*'` is
incompatible with credentialed requests and is a Never Do regardless.

## Decision

- `CORS_ORIGIN` (validated as required in `backend/src/app.module.ts:37`, via
  `Joi.string().pattern(/\S/).required()` — the pattern check specifically rejects a
  whitespace-only string that would otherwise satisfy `.required()` and produce an empty allowlist) is
  a single env var holding a comma-separated list of allowed origins.
- `backend/src/main.ts:57` splits it into an array (`.split(',').map(origin => origin.trim())`) before
  passing it to `app.enableCors({ origin, credentials: true, ... })`.
- Local dev default covers both `frontend/` (`:5173`) and `admin/` (`:5174`); see
  `backend/.env.example` for the example value.
- `credentials: true` is required alongside this, since both frontends rely on the httpOnly
  `refreshToken` cookie (`withCredentials` / `credentials: 'include'`).

## Consequences

- Never suggest `origin: '*'` — it is incompatible with `credentials: true` and defeats the purpose of
  an allowlist.
- Never hardcode origins directly in `main.ts` instead of reading `CORS_ORIGIN` — that reintroduces a
  second source of truth for the allowlist.
- Adding a third frontend/admin consumer (e.g. a future mobile web client) requires adding its origin
  to `CORS_ORIGIN` in every deployment environment — it will not work by omission, and there is no
  fallback.
