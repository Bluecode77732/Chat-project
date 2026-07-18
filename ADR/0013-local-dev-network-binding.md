# 0013: Local dev services bind to 127.0.0.1 only, with Redis auth

## Status

Accepted

## Context

A confirmed incident: local Docker Compose services were originally bound to `0.0.0.0:PORT:PORT`,
exposing them on every network interface. The development machine's Ethernet adapter held a public IP
while the Windows Firewall profile was set to "Private (trusted)," which activated a Docker Desktop
firewall rule allowing inbound connections on any port. As a result, PostgreSQL (5432), Redis (6379),
and the backend (3000) were reachable from the internet, and an automated ransomware bot accessed
PostgreSQL using default credentials, wiped the databases, and left a ransom note in a
`readme_to_recover` database. Full write-up in README's
[AI-Assisted Development Notes](../README.md#ai-assisted-development-notes).

## Decision

- All `docker-compose.yml` port bindings are `127.0.0.1:PORT:PORT`, not `0.0.0.0:PORT:PORT`
  (`docker-compose.yml:17-18, 31-32, 55-56` — backend, Postgres, Redis).
- `backend/src/main.ts` binds its HTTP listener to `127.0.0.1` when run bare via `pnpm start:dev`
  (`NODE_ENV=development`). This is a separate hardening measure for that specific local-run path, not
  what closed the incident above — under `docker-compose` (`NODE_ENV=docker`), `main.ts` deliberately
  keeps binding to `0.0.0.0` internally (the container has to accept connections from the Docker
  network), so the docker-compose exposure was closed entirely by the port-mapping change, not by this
  in-process binding (`main.ts:100-103`, inline comment).
- Redis requires a password (`requirepass`) even in local dev, not just in production.
- Response order for any similar exposure is containment (network) → credential rotation → artifact
  cleanup, in that order — see CLAUDE.md's "Containment Before Cleanup" principle under
  [Incident Response](../CLAUDE.md#incident-response), which formalizes the order actually followed
  during this incident.

## Consequences

- Reaching the local dev server from another device on the LAN (e.g. testing from a phone) needs an
  SSH tunnel or explicit port-forward instead of a bare `IP:port` — a real but small inconvenience
  traded for closing a proven attack path.
- Never suggest reverting any `docker-compose.yml` port binding to `0.0.0.0` "for convenience" (e.g. to
  test from another device) — this is the exact configuration that led to the confirmed data-loss
  incident above, not a hypothetical risk.
- Never suggest running Redis without `requirepass` in any environment, local dev included — the
  incident specifically involved a service reachable without credentials.
- Any new service added to `docker-compose.yml` must default to a `127.0.0.1:PORT:PORT` binding; a
  bare `PORT:PORT` (which Docker binds to all interfaces) is a Never Do Group 3-equivalent violation
  for this project, on par with `CORS_ORIGIN: '*'`.
