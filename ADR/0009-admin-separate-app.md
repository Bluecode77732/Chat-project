# 0009: Admin dashboard as a fully separate app, not a route in `frontend`

## Status

Accepted

## Context

User/room management, moderation actions, and audit-log export need a UI. The alternative to a
standalone app was a protected route (e.g. `/admin`) inside the existing `frontend` package, gated by
`protected-route.tsx` and a role check — which would have meant one codebase, one bundle, one Vercel
project instead of two.

## Decision

`admin/` is its own pnpm workspace package: its own React app, its own `vercel.json`, its own Vercel
project, its own Playwright e2e suite (`admin/e2e/`, CI job `admin-e2e`), and no `graphql-ws`/
`socket.io-client` dependency at all (it is query/mutation-only against the GraphQL API and never
participates in realtime chat delivery — see the [System Context](../ARCHITECTURE.md#system-context)
diagram).

- **Why:** the codebase split was made specifically for permission/security boundary separation — per
  the developer, keeping admin-only code physically out of the bundle shipped to every regular chat
  user structurally reduces the surface through which admin functionality could be exposed. A route
  gate inside `frontend` still ships the admin UI code (component tree, mutation strings, moderation
  action handlers) to every visitor's browser bundle, relying entirely on a runtime check to hide it;
  a separate app never ships that code to a non-admin user in the first place.

## Consequences

- Two Vercel projects means two entries in `CORS_ORIGIN` to maintain in every environment (see
  [0005](0005-cors-multi-origin-policy.md)) and two separate deploy pipelines/observability
  dashboards to check instead of one.
- Any new admin-only feature belongs in `admin/`, not behind a role check inside `frontend` — adding
  an admin route to `frontend` would reintroduce the exact bundle-exposure this split exists to avoid.
- `admin/` intentionally has no realtime dependency; never suggest adding `graphql-ws` or
  `socket.io-client` to it to "share code" with `frontend` — that would blur the query/mutation-only
  boundary this app was built around.
