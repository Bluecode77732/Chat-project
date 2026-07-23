---
name: Architecture doc completeness sweep
about: Periodic manual review for documentation gaps automation cannot catch (undocumented components, missing ADR cross-links, incomplete sections)
title: "Architecture doc completeness sweep — <YYYY-MM>"
labels: documentation
---

## Scope

This checklist targets the one class of documentation gap that has no automated
check: **content that should be documented but simply isn't yet** — e.g.
`PubSubService` going unexplained in ARCHITECTURE.md despite being referenced
constantly, until a manual sweep caught it.

Citation `file:line` accuracy, EN/KO section-count parity, and multi-location
config-value drift (e.g. `MODERATION_DEFAULTS`) are already covered by
`pnpm check:adr` and `pnpm check:config` in CI — do not re-verify those here,
just confirm both pass (`pnpm check:adr && pnpm check:config && pnpm check:deps`).

## Checklist

- [ ] Diff `backend/src/*/` against ARCHITECTURE.md's Module Dependency Graph
      table — any new module, provider, or cross-module dependency not listed?
- [ ] For each `backend/src/**/*.ts` file that isn't a `*.spec.ts`, DTO, or
      entity — is it named anywhere in ARCHITECTURE.md or CLAUDE.md, or does
      it deserve at least a one-line mention?
- [ ] Diff `ADR/` against ARCHITECTURE.md's inline `[ADR NNNN]` links — any ADR
      that covers a topic ARCHITECTURE.md already discusses but never links to?
- [ ] Spot-check 2-3 components referenced often in prose but never
      structurally explained — read their actual current source and confirm
      the doc's characterization still matches (this is how the `PubSubService`
      gap and the "Redis client count" undercount were both found).
- [ ] README.md's Features / Project Structure / Entities sections — any
      recent PR that added a user-visible feature without a matching update?

## Out of scope for this checklist (already automated)

- Citation `file:line` accuracy — `pnpm check:adr`
- `MODERATION_DEFAULTS` / other multi-location config values — `pnpm check:config`
- EN/KO heading-structure parity — `pnpm check:adr`
- Dependency list accuracy — `pnpm check:deps`
