# ContractIQ — Security Plan

**Stage:** 7 (Security Fixes) · **Skill:** `skills/security-foundation/SKILL.md` · **Date:** 2026-10-25
**Scope:** `contractiq/` application code, `contractiq/supabase/database.sql`, `contractiq/supabase/rls-policies.sql`, Supabase project settings.
**Inputs:** PRD §5/§11, `docs/engineering/engineering-doc.md`, `docs/specs/security.md`, and a code scan of the implemented app.

---

## 1. Security surfaces

| Surface | Entry points | Primary controls |
|---|---|---|
| Authentication | `/api/auth/{login,signup,logout,forgot-password,reset-password}`, `/auth/callback`, `middleware.ts` | Supabase Auth, server-side session cookies, rate limiting, open-redirect guard, no account enumeration |
| Protected pages | `/dashboard`, `/contracts/*`, `/chat`, `/settings`, `/profile` | Middleware redirect + server-side `getUser()` re-check in `(app)/layout.tsx` |
| API (11 data routes) | `app/api/**` | `requireAuth()`, Zod validation (422), CSRF origin check, rate limits, 404-on-foreign |
| File upload | `POST /api/contracts/upload` | Extension blocklist → allowlist → MIME → size → magic bytes → page/word/token limits; private bucket; owner-folder Storage RLS |
| AI (extraction + chat) | `/process`, `/chat` | Prompt-injection guard on user text, untrusted-data system prompts, schema-constrained output, server-side token re-count, output leak guard, history cap |
| Database | 9 tables, 5 RPCs, 1 view | RLS on every table, least-privilege grants, server-authoritative writes, integrity constraints |
| Storage | `contracts` bucket | Private, 10 MB, PDF only, folder = `auth.uid()`, 1-hour signed URLs only |
| Secrets | `.env.local`, Netlify env | Server-only modules, single `createAdminClient()`, no secrets in logs or client bundle |
| Background jobs | purge, cost / correction alerts | Service role, owner-path verification before deleting objects |

---

## 2. Issues found and fixed

| # | Severity | Issue (found by code scan) | Fix |
|---|---|---|---|
| 1 | **High** | Users could insert/update `contracts` directly via the Supabase REST API with their own JWT — e.g. replace `contract_text` with unbounded text (bypassing the 15k-token check → OpenAI cost abuse) or forge `status`/`token_count` | Contract inserts/updates are now **server-authoritative** (service role, scoped to the verified user). Client `INSERT`/`UPDATE` on `contracts` revoked; `contract_text` bounded by a CHECK; `/process` re-counts tokens on the stored text before every LLM call |
| 2 | **High** | Cross-tenant file deletion: a user could set `contracts.file_path` to another user's object; the 90-day purge job (service role, bypasses Storage RLS) would then delete the victim's PDF | `file_path` can no longer be written by clients; CHECK constraint `contracts_file_path_owner` forces `{user_id}/{contract_id}/…`; purge job independently verifies the prefix and refuses anything else |
| 3 | Medium | Users could insert fake extracted `key_terms` and forge **assistant** chat messages, which were then replayed to the model as trusted history | Client `INSERT`/`DELETE` on `key_terms` revoked (edits only via `edit_key_term`); chat insert policy now requires `role = 'user'`; assistant messages written by the server only; stored user turns that fail the injection screen are never replayed |
| 4 | Medium | No prompt-injection screening of user text sent to the model (chat questions, custom term names) | `sanitizeForLLM()` blocks injection patterns with `400 PROMPT_INJECTION` before any AI call; custom terms re-screened at processing time (they can also be written via the `replace_custom_terms` RPC) |
| 5 | Medium | Model output was not checked for leaked prompts or secrets | `guardModelOutput()` replaces answers that echo the system prompt or contain key/JWT patterns (logged as `chat_output_blocked`) |
| 6 | Medium | Sign-in/sign-up/sign-out ran in the browser: no app-level rate limit on credential attempts | Server routes `/api/auth/login`, `/signup`, `/logout` (cookies set server-side); auth limited to 10 req/min per (hashed) IP |
| 7 | Medium | No password-reset flow | `/forgot-password` → email link → `/auth/callback?next=/reset-password` → `/reset-password` (requires the recovery session) → forced re-login |
| 8 | Medium | Account enumeration: sign-up said "An account with this email already exists" | Sign-up and forgot-password return the same response whether or not the email is registered |
| 9 | Low | Fixed-window limiter allowed 2× bursts at window edges; limits did not match the security baseline; auth unlimited | Sliding-window limiter on `rate_limit_events` (service role only): auth 10/min, chat 30/min, process 5/h, upload 20/day; `429 RATE_LIMITED` + `Retry-After` |
| 10 | Low | Chat allowed on contracts that were not processed; session ownership implicit | `verifyContractOwnership(requireCompleted)` + `verifySessionOwnership()` before every chat request |
| 11 | Low | Validation errors returned 400; list query silently replaced invalid params | All validation failures → `422 VALIDATION_ERROR`; `/api/contracts` rejects unknown/invalid query params |
| 12 | Low | Service-role key read in two places | Single `createAdminClient()` in `lib/supabase/admin.ts` (throws if ever evaluated in a browser) |
| 13 | Low | Upload accepted any filename extension (only content was checked) | `validateFileUpload()` — blocklist (incl. double extensions like `x.exe.pdf`) → allowlist → MIME → size, then `%PDF-` signature |
| 14 | Low | Protected-route list missed `/chat`, `/settings`, `/profile` | Added to `middleware.ts` (future routes are protected by default) |

---

## 3. Controls implemented

### 3.1 Authentication & protected routes
- Supabase Auth (email + password). Session in HttpOnly cookies managed by `@supabase/ssr`; `middleware.ts` refreshes it on every request and forwards Supabase's no-cache headers so auth responses are never cached.
- `middleware.ts` protects `/dashboard`, `/contracts`, `/chat`, `/settings`, `/profile` (redirect to `/login?redirectTo=…`); signed-in users on `/login`, `/signup`, `/forgot-password` go to `/dashboard`.
- `(app)/layout.tsx` re-verifies with `supabase.auth.getUser()` (defence against middleware bypass — see Next.js note §6).
- Server routes: `POST /api/auth/login`, `/signup`, `/logout`, `/forgot-password`, `/reset-password`. The client never calls `signInWithPassword`/`signOut` directly.
- `safeRedirectPath()` blocks open redirects on `redirectTo` / `next`.

### 3.2 API request validation
- Every route validates params, query, JSON body and files with Zod (schemas in `lib/validation/*`, re-exported by `lib/security/inputValidator.ts`). Failures → `422 VALIDATION_ERROR` with per-field messages, before any DB or AI call.
- JSON bodies ≤ 64 KB and must be `application/json`; malformed ids → 404.
- CSRF: mutating requests with a foreign `Origin` → `403 FORBIDDEN_ORIGIN`.

### 3.3 Rate limiting (`lib/security/rateLimiter.ts`)
| Action | Limit | Subject |
|---|---|---|
| auth (login, signup, forgot/reset password) | 10 / minute | salted SHA-256 of client IP (`x-nf-client-connection-ip` preferred) |
| chat | 30 / minute | user id |
| process | 5 / hour | user id |
| upload | 20 / day | user id |

Sliding window over `rate_limit_events`, read/written only by the service role (users cannot see or reset counts). Exceeded → `429 RATE_LIMITED` + `Retry-After`. Fails **open** (error log `rate_limit_unavailable` / `rate_limit_check_failed`) so a limiter outage does not take the app down. Events older than 2 days are pruned by the daily purge job.

### 3.4 Prompt-injection protection (`lib/security/promptInjectionGuard.ts`)
- `sanitizeForLLM()` on chat messages and custom term names: strips control/zero-width characters, normalises (NFKC, case, leetspeak) and blocks: ignore/override instructions, reveal/print system prompt, expose env variables / API keys / database contents, role switching ("you are now a", AI-directed "act as", "pretend you are"), jailbreak / DAN / developer mode, delimiter spoofing (`</contract>`, `<|im_start|>`). → `400 PROMPT_INJECTION`; the AI is not called.
- Contract text is **not** blocked (legitimate clauses say "the Provider shall act as…"); system prompts mark it as untrusted data, output is schema-constrained (extraction) and the model has no tools.
- `guardModelOutput()` on chat answers; history replay excludes user turns that fail the screen.
- The model never receives env variables, keys or database contents.

### 3.5 Token & usage limits (`lib/security/tokenLimiter.ts`)
| Limit | Value | Note |
|---|---|---|
| Max file size | 10 MB | = Storage bucket limit |
| Max pages | 20 | PRD FR-02 (stricter than the baseline's 200) |
| Max message length | 2,000 chars | Spec (stricter than the baseline's 5,000) |
| Max contract tokens | 15,000 | Re-counted on the stored text before every LLM call |
| Chat history to model | `MAX_CHAT_HISTORY` (default 100, max 198) | Plus a 100k-token prompt budget |
| Output tokens | 4,000 extraction / 1,000 chat | `max_tokens` |

### 3.6 Chat security (`lib/security/chatSecurity.ts`)
`verifyContractOwnership(db, contractId, userId, { requireCompleted: true })` and `verifySessionOwnership(session, userId, contractId)` run before every chat request; failures → 404 (409 if the contract isn't processed yet).

### 3.7 File upload security (`lib/security/inputValidator.ts`)
Order: (1) extension — blocklist `.exe .js .mjs .cjs .php .zip .sh .bat .cmd .py .rb .ps1` (+ `.html .svg .jar .msi .dll …`, any segment of a multi-dot name) then allowlist `.pdf`; (2) MIME `application/pdf`; (3) size ≤ 10 MB; then `%PDF-` magic bytes, pdf.js parse, ≤ 20 pages, ≥ 100 words, ≤ 15k tokens. Files go to the **private** `contracts` bucket at `{user_id}/{contract_id}/{slug}.pdf`; only 1-hour signed URLs are ever returned.

### 3.8 Database (RLS & privileges)
- RLS enabled on all 9 tables; owner-only policies; `anon` has no table privileges.
- Least-privilege grants: `contracts` select/delete; `key_terms` select + update(value, original_value, is_edited, edited_at); `chat_messages` insert only `role='user'`; `profiles` update(full_name, onboarding_completed_at); `llm_usage` select own; `rate_limit_events` none.
- Server-authoritative writes (service role, always `.eq('user_id', verifiedUserId)`): contract create/status/file path/last access/review complete, key terms, assistant messages, usage logs, rate-limit events.
- Constraints: `contracts_text_size` (≤ 200,000 chars), `contracts_file_path_owner`.
- Self-checks in `database.sql` and `rls-policies.sql` abort the transaction if any of the above is missing.

### 3.9 Environment variables
| Variable | Exposure |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CALIBRATION_WARNING` | Client-safe |
| `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `USER_ID_HASH_SALT`, `SLACK_ALERT_WEBHOOK_URL`, `MAX_CHAT_HISTORY` | Server only |

`SUPABASE_SERVICE_ROLE_KEY` is read only in `createAdminClient()`. `lib/env.ts` validates config (rejects a placeholder salt). The logger never logs keys, JWTs, prompts, contract or chat text; IPs are stored only as salted hashes. A production build was checked to contain no secret in `.next/static`.

### 3.10 Other controls (already in place, re-verified)
Security headers (CSP, nosniff, Referrer-Policy, Permissions-Policy, HSTS); no `dangerouslySetInnerHTML`; no Server Actions / `pages/` / rewrites (Next 14 advisory mitigations); OpenAI `user` = salted hash; usage + cost telemetry and budget alerts; 90-day PDF retention; cascade delete.

---

## 4. Files

**Created:** `lib/security/{authGuard,rateLimiter,promptInjectionGuard,tokenLimiter,chatSecurity,inputValidator}.ts`, `lib/validation/index.ts`, `lib/auth/supabase-auth-errors.ts`, `app/api/auth/{login,signup,logout,forgot-password,reset-password}/route.ts`, `app/(auth)/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `components/auth/{AuthShell,ForgotPasswordForm,ResetPasswordForm}.tsx`, `supabase/rls-policies.sql`, `tests/unit/lib/security/*` (4 files), `docs/security/security-plan.md`.

**Modified:** `supabase/database.sql` (+ `docs/specs/supabase-schema.sql` copy), `types/database.types.ts`, `lib/supabase/admin.ts`, `lib/api/errors.ts`, `lib/db/{contracts,key-terms}.repo.ts`, `lib/services/{contract,extraction,chat,custom-terms}.service.ts`, `lib/jobs/purge-expired-pdfs.ts`, `lib/validation/{auth,contracts-query}.ts`, `lib/env.ts`, all `app/api/**/route.ts`, `app/(auth)/layout.tsx`, `app/(app)/contracts/[id]/page.tsx`, `middleware.ts`, `components/auth/{LoginForm,SignupForm}.tsx`, `components/layout/UserMenu.tsx`, `netlify/functions/*.ts`, `scripts/purge-expired-pdfs.ts`, `.env.example`, tests.

**Removed:** `lib/api/require-user.ts` (→ `authGuard.ts`), `lib/api/rate-limit.ts` (→ `rateLimiter.ts`), `lib/jobs/admin-client.ts` (→ single `createAdminClient()`), DB `rate_limits` table + `check_rate_limit()`.

---

## 5. Deviations from the security baseline (and why)

| Baseline | Implemented | Reason |
|---|---|---|
| Allow `.pdf` and `.docx` | `.pdf` only | PRD FR-02 scopes MVP to text-layer PDFs; DOCX has no extractor, so accepting it would only produce failures |
| Max 200 pages / 5,000-char messages | 20 pages / 2,000 chars | PRD/spec limits are stricter |
| `rate_limit_events.user_id NOT NULL` | `user_id` nullable + `subject` | Auth requests have no user; they are limited per salted IP hash |
| Block "act as" | Block AI-directed "act as …" only | Contract questions legitimately use "act as" ("Does the Provider act as an agent?") |
| `requireAuth()` "returns user or 401 response" | Throws `AppError('UNAUTHENTICATED')`, rendered as 401 by `withApiHandler` | Same HTTP result; keeps one error pipeline |

---

## 6. Outstanding items / manual steps

| # | Item | Owner |
|---|---|---|
| 1 | **Run `contractiq/supabase/rls-policies.sql`** in the Supabase SQL Editor (until then: rate limiting fails open and DB-level hardening #1–#3 is not enforced, although the app no longer relies on client writes) | You |
| 2 | Supabase → Authentication: **Confirm email ON** for production (custom SMTP), **Secure password change / reauthentication ON**, **Refresh token rotation ON** with reuse interval 10 s, JWT expiry 3600 s, Site URL + redirect URLs incl. `/auth/callback` | You (dashboard) |
| 3 | Supabase → Auth → Rate limits: keep defaults (email sends, token refresh) as a second layer | You |
| 4 | **Next.js 14 is end-of-life** with open critical advisories (fixed only in 15.5/16). Mitigations are in place; upgrade before public launch | Decision pending |
| 5 | Netlify synchronous functions accept request bodies up to ~6 MB; 10 MB uploads need either a larger limit or direct-to-Storage signed uploads before deploying | Stage 6 |
| 6 | Rotate the OpenAI and Supabase service-role keys that were pasted into chat during setup | You |
| 7 | `MAX_CHAT_HISTORY=100` is in `.env.local`; set it in Netlify too | Stage 6 |
| 8 | Prompt-injection patterns are heuristic: review `chat_output_blocked` / `PROMPT_INJECTION` logs monthly and extend `PATTERNS` | Ongoing |

---

## 7. Verification

- Unit tests: `tests/unit/lib/security/*` (injection patterns + false-positive cases, upload validation order, limits, ownership checks, sliding-window limiter, IP header precedence), `tests/unit/supabase/database-sql.test.ts` (server-authoritative grants, constraints), `tests/unit/lib/jobs/jobs.test.ts` (purge refuses cross-tenant paths).
- End-to-end checks against the live project (`scratchpad/smoke.mjs`, `security-check.mjs`): auth routes, 422 validation, prompt-injection 400, rate-limit 429, cross-user 404s, direct REST writes rejected after the migration, CSRF 403.
