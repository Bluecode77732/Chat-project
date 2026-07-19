# 0020: Security headers split (Helmet backend / CSP frontend+admin) and IP-based auth rate limiting

## Status

Accepted

## Context

Three deployables have very different rendering surfaces: `backend` serves almost no HTML (REST/GraphQL
are JSON-only, plus a Swagger UI at `/document`), while `frontend`/`admin` are the actual pages a
browser renders and where stored-XSS via `ChatEntity.message` (see CLAUDE.md's
[Render-Surface Sanitization](../CLAUDE.md#chat--caching)) or clickjacking would land. Separately,
`POST /auth/signin` and `POST /auth/register` have no authenticated `userId` yet to key a rate limit off
of — the existing `RateLimitGuard` (per-user, [ADR 0016](0016-redis-unavailability-policy.md)) can't be
reused as-is for this pre-auth stage, but credential-stuffing/brute-force against these two endpoints
still needed a velocity limit.

## Decision

- **Helmet** (`helmet@^8.3.0`) is applied backend-wide via `app.use(helmet({ contentSecurityPolicy:
  false }))` (`main.ts:37`), giving the rest of Helmet's default protections (`X-Frame-Options`,
  `X-Content-Type-Options`, etc.) while explicitly disabling Helmet's own CSP generation — a CSP header
  on `backend` would only ever protect `/document` (Swagger), which needs broad inline-script exceptions
  anyway, and can't reach the actual XSS-relevant surface (a different origin).
- **CSP is applied instead at `frontend`/`admin`** via each app's static Vercel `headers` config
  (`frontend/vercel.json`, `admin/vercel.json`) rather than a backend response header, since that's
  where the rendering actually happens. The two policies differ: `frontend`'s includes
  `style-src 'self' 'unsafe-inline'`, `admin`'s does not — both apps use the same styling stack
  (Tailwind, confirmed via `package.json`), but only `frontend/src/pages/chat-page.tsx` uses a React
  inline `style={{...}}` prop (which renders as an inline `style` attribute CSP's `style-src` blocks
  without `'unsafe-inline'` or a nonce/hash); `admin` has zero such usages, so its policy is stricter by
  default rather than by an explicit decision recorded anywhere.
- `app.set('trust proxy', 1)` (`main.ts:29`) trusts exactly the immediate reverse-proxy hop (Railway) so
  `req.ip` resolves to the real client IP instead of Railway's proxy address — load-bearing for the next
  point, since without it every client would collapse into one shared rate-limit bucket.
- `AuthRateLimitGuard` (`backend/src/auth/guard/auth-rate-limit.guard.ts`) rate-limits `signin`/`register`
  by client IP (not `userId`, unavailable pre-auth): 10 attempts per 60-second window per
  `auth:{handler}-attempt:{ip}` key, using the identical atomic `INCR`+conditional-`EXPIRE` Lua pattern
  and fail-closed-on-Redis-error handling as `RateLimitGuard` — reusing the established hand-rolled
  pattern rather than introducing a new dependency (e.g. `@nestjs/throttler`) for one additional guard.
- Alternatives considered and rejected:
  - **Helmet's CSP enabled on `backend` as well**: rejected — the only HTML `backend` serves is Swagger
    UI at `/document`, which needs inline-script exceptions that would gut the policy anyway, and a
    header set here cannot reach `frontend`/`admin` (separate origins) where the real rendering happens.
  - **`@nestjs/throttler` for the auth rate limit**: rejected — a new runtime dependency for one guard,
    when `RateLimitGuard`'s atomic Lua `INCR`+`EXPIRE` pattern (and its Redis fail-closed handling, see
    [0016](0016-redis-unavailability-policy.md)) already exists and is reused verbatim here.
  - **`trust proxy: true`** (trust the whole `X-Forwarded-For` chain) instead of `1`: rejected — a client
    could then supply its own forged `X-Forwarded-For` header and get a fresh rate-limit bucket per
    request, defeating `AuthRateLimitGuard` entirely.
  - **Extracting one shared rate-limit helper** used by both guards: not done — per-user and per-IP keying
    differ enough that the extraction isn't trivially clean today; revisit if a third call site appears
    (also noted under Consequences).

## Consequences

- The `frontend`/`admin` CSP asymmetry (`style-src 'unsafe-inline'` present only in `frontend`) is
  currently a side effect of which app happens to use an inline `style` prop, not a deliberate documented
  policy — if `admin` ever adds a component using inline styles, its CSP will silently block it until
  someone notices and updates `admin/vercel.json`. Conversely, if `chat-page.tsx`'s inline style is ever
  removed, `frontend/vercel.json` should be tightened to match `admin`'s stricter policy.
- `trust proxy` set to `1` (not `true`/unbounded) is deliberate: trusting the full `X-Forwarded-For`
  chain would let a client spoof its own IP by supplying a fake header value, defeating
  `AuthRateLimitGuard` entirely. Never widen this without confirming Railway's actual proxy topology
  hasn't changed.
- `AuthRateLimitGuard` and `RateLimitGuard` are two separate implementations of the same atomic
  Lua-script pattern rather than one shared utility — acceptable duplication for now (per-user vs
  per-IP keying differs enough to make extraction non-trivial), but a third call site with the same
  shape should trigger extracting a shared helper instead of a third copy.
- Never suggest enabling Helmet's CSP on `backend` "for consistency" — it would only add
  Swagger-breaking friction without protecting the actual rendering surface, per the Context above.
