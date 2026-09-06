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
> 이 체크리스트는 자동 검사가 잡아내지 못하는 한 종류의 문서 갭을 다룸:
> **문서화돼야 하는데 아직 안 된 내용** — 예를 들어 `PubSubService`가 계속
> 언급되는데도 ARCHITECTURE.md에 설명이 없었던 경우, 수동 점검에서만 잡힘.

Citation `file:line` accuracy, EN/KO section-count parity, and multi-location
config-value drift (e.g. `MODERATION_DEFAULTS`) are already covered by
`pnpm check:adr` and `pnpm check:config` in CI — do not re-verify those here,
just confirm both pass (`pnpm check:adr && pnpm check:config && pnpm check:deps`).
> `file:line` 인용 정확도, EN/KO 섹션 수 일치, `MODERATION_DEFAULTS` 같은 다중
> 위치 설정값 드리프트는 이미 `pnpm check:adr`, `pnpm check:config`가 CI에서
> 커버함 — 여기서 다시 검증하지 말고 둘 다 통과하는지만 확인
> (`pnpm check:adr && pnpm check:config && pnpm check:deps`).

## Checklist

- [ ] Diff `backend/src/*/` against ARCHITECTURE.md's Module Dependency Graph
      table — any new module, provider, or cross-module dependency not listed?
      > `backend/src/*/`를 ARCHITECTURE.md의 Module Dependency Graph 표와 대조
      > — 새 모듈/프로바이더/모듈 간 의존성이 빠진 게 있는지
- [ ] For each `backend/src/**/*.ts` file that isn't a `*.spec.ts`, DTO, or
      entity — is it named anywhere in ARCHITECTURE.md or CLAUDE.md, or does
      it deserve at least a one-line mention?
      > `*.spec.ts`, DTO, entity가 아닌 `backend/src/**/*.ts` 파일마다 —
      > ARCHITECTURE.md나 CLAUDE.md 어디엔가 언급돼 있는지, 최소 한 줄이라도
      > 필요한지
- [ ] Diff `ADR/` against ARCHITECTURE.md's inline `[ADR NNNN]` links — any ADR
      that covers a topic ARCHITECTURE.md already discusses but never links to?
      > `ADR/`을 ARCHITECTURE.md 인라인 `[ADR NNNN]` 링크와 대조 — 이미 논의된
      > 주제인데 링크가 안 걸린 ADR이 있는지
- [ ] Spot-check 2-3 components referenced often in prose but never
      structurally explained — read their actual current source and confirm
      the doc's characterization still matches (this is how the `PubSubService`
      gap and the "Redis client count" undercount were both found).
      > 본문에서 자주 언급되지만 구조적으로 설명된 적 없는 컴포넌트 2-3개 골라
      > 실제 소스를 다시 읽고 문서 설명이 여전히 맞는지 확인 (이 방식으로
      > `PubSubService` 갭과 "Redis client count" 과소집계를 둘 다 찾음)
- [ ] README.md's Features / Project Structure / Entities sections — any
      recent PR that added a user-visible feature without a matching update?
      > README.md의 Features/Project Structure/Entities 섹션 — 최근 PR이
      > 사용자에게 보이는 기능을 추가했는데 문서 갱신이 빠진 게 있는지

## Out of scope for this checklist (already automated)

- Citation `file:line` accuracy — `pnpm check:adr`
  > `file:line` 인용 정확도 — `pnpm check:adr`
- `MODERATION_DEFAULTS` / other multi-location config values — `pnpm check:config`
  > `MODERATION_DEFAULTS` 등 다중 위치 설정값 — `pnpm check:config`
- EN/KO heading-structure parity — `pnpm check:adr`
  > EN/KO 섹션 구조 일치 — `pnpm check:adr`
- Dependency list accuracy — `pnpm check:deps`
  > 의존성 목록 정확도 — `pnpm check:deps`
