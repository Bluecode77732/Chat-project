# 0011: Google Gemini as the AI reply provider

## Status

Accepted

## Context

The chat app added an AI-companion feature (`AiService`, `AiRoomService`) that needs an LLM API for
generating replies, with four selectable personalities and cost caps (token limits, retry ceiling,
conversation-history truncation) by design.

## Decision

Use Google Gemini 2.5 Flash via `@google/genai`, registered as `GENAI_CLIENT` through a `useFactory`
provider in `AiModule`.

- **Why:** per the developer, Gemini was an appropriate fit for the actual goal — simple, cost-effective
  AI conversation — relative to its cost ("사용 비용에 비해 단순한 AI와의 대화하기 목적을 달성하기 위한
  대상으로 적절했음"). This was not a comparative evaluation against a specific competing provider; it
  was chosen as adequate and inexpensive for the feature's actual scope (short conversational replies,
  not a capability-intensive use case).
- Alternatives considered and rejected: **none, explicitly.** No structured comparison against other
  providers (OpenAI's GPT models, Anthropic's Claude) was performed before this choice — stating that
  plainly here rather than inventing a comparison that didn't happen. Gemini was picked directly for
  cost/simplicity fit to the feature's actual scope, per the developer.

## Consequences

- Per-token billing means unbounded prompt size or retries translate directly into cost — mitigated by
  the token/history/retry caps already in `ai.service.ts` (see CLAUDE.md's Cost Awareness principle).
  Any change that increases prompt size, conversation-history length, or retry ceiling must re-justify
  the cost impact, not just the feature value.
- A third-party API outage or rate-limit means AI replies silently stop; this is already handled as a
  caught, logged skip (`handleReply`'s `try/catch/finally`) rather than a crash — the failure mode is
  "no AI reply," not "broken chat," and any future change to this path must preserve that degradation
  behavior.
- Never suggest replacing Gemini with another provider (OpenAI, Claude, etc.) without an explicit
  request — the choice was made for cost/simplicity fit to this specific feature, not for any
  technical capability Gemini uniquely provides, so a substitution is a product decision, not a bug fix.
