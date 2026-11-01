# Spec — Foundation & Conventions (S1)

**Source:** engineering-doc §5, §6, §11, §12 · **Release:** v0.1 · **Project root:** `contractiq/` (root `app/` layout, no `src/`)

This spec covers everything that all features share: dependencies, configuration, folder layout, environment validation, the Supabase and OpenAI clients, the API handler/error/auth/rate-limit/streaming helpers, and logging. Feature specs assume this exists.

---

## 1. Dependencies

Upgrade the scaffold's `package.json` to the following. Versions are minimum ranges; `npm install` resolves to the latest compatible release.

**Runtime (`dependencies`)**

| Package | Range | Why |
|---|---|---|
| `next` | `~14.2.35` | Latest Next 14 release. 14.2.5 (the scaffold pin) has the critical middleware auth-bypass (CVE-2025-29927). **Next 14 is end-of-life:** even 14.2.35 carries open advisories, including critical RCEs in the Image Optimization API and on Windows hosts, fixed only in Next 15.5.x/16.x. See §1.1 |
| `react`, `react-dom` | `^18.3.1` | Next 14 requires React 18 |
| `@supabase/supabase-js` | `^2.118.0` | DB, Auth, Storage |
| `@supabase/ssr` | `^0.12.7` | Cookie-based sessions in App Router (`createServerClient` with `getAll`/`setAll`) |
| `openai` | `^7.43.0` | Chat Completions, Structured Outputs, `zodResponseFormat`. **Requires Node ≥ 22** |
| `zod` | `^4.6.7` | Validation (zod 4 API, e.g. `z.email()`, `z.url()`). zod < 4.6.6 has a high-severity memory-exhaustion advisory (GHSA-mrhx-c7xc-m3w5). Supported by `openai@7` and `@hookform/resolvers@5` |
| `pdf-parse` | `1.1.1` (exact) | PDF text extraction (server). Import `pdf-parse/lib/pdf-parse.js` |
| `gpt-tokenizer` | `^4.1.0` | Local GPT-4o (`o200k_base`) token counting via `gpt-tokenizer/model/gpt-4o` |
| `react-pdf` | `^9.2.1` | PDF.js viewer. **Stay on 9.x:** v10+ requires React 19 |
| `@tanstack/react-query` | `^5.104.0` | Server state |
| `zustand` | `^5.0.16` | Client UI state |
| `react-hook-form` | `^7.91.0` | Forms |
| `@hookform/resolvers` | `^5.2.2` | zod resolver (6.x has an unresolvable optional-peer conflict on `effect`) |
| `react-dropzone` | `^14.4.1` | Upload dropzone (14.x API) |
| `react-resizable-panels` | `^2.1.9` | Results two-panel layout (2.x API: `PanelGroup`/`Panel`/`PanelResizeHandle`) |
| `@radix-ui/react-dialog`, `-alert-dialog`, `-tooltip`, `-popover`, `-tabs`, `-select`, `-dropdown-menu`, `-slot` | latest 1.x/2.x | Accessible primitives (React 18 supported) |
| `lucide-react` | `^0.577.0` | Icons (0.x icon names, e.g. `Loader2`) |
| `sonner` | `^2.0.8` | Toasts |
| `clsx`, `tailwind-merge` | latest | `cn()` helper |
| `server-only` | `^0.0.1` | Build-time guard for secrets |

Versions were verified against the npm registry on 2026-10-25. **Node.js 22 LTS or newer** is required locally and on Netlify (`NODE_VERSION = "22"`), because of `openai@7`.

### 1.1 Next.js 14 security posture (required reading)

The stack is fixed at Next.js 14 by CLAUDE.md and `/frontend-setup`. As of 2026-10, `npm audit` on `next@14.2.35` reports unresolved advisories whose fixes exist only in 15.5.x/16.x. Until the major upgrade is approved, the app **must** apply these mitigations:

| Advisory class | Mitigation in this codebase |
|---|---|
| RCE / DoS / SSRF in the Image Optimization API | `images: { unoptimized: true }` in `next.config.mjs`. `next/image` is still allowed but never hits `/_next/image` |
| RCE on Windows-hosted servers | Deploy only on Linux (Netlify). Local Windows dev is out of scope |
| Server Actions DoS / SSRF / payload issues | **No Server Actions anywhere.** All mutations go through Route Handlers. Lint rule: grep for `'use server'` in CI fails the build |
| Middleware bypass (Pages Router) | App Router only; no `pages/` directory. Route handlers re-check auth with `requireUser()` (defence in depth) |
| Rewrites SSRF / request smuggling | No `rewrites()` in `next.config.mjs` |
| RSC cache poisoning / XSS in `beforeInteractive` | No `<Script strategy="beforeInteractive">`. Authenticated pages export `dynamic = 'force-dynamic'` |

**Decision required before Stage 6 (Deploy):** upgrade to the current Next 15.5.x/16.x line, which `npm audit` lists as the fix, or accept the residual risk in writing. Local development at `localhost:3000` is unaffected in practice.

**Development (`devDependencies`)**: `typescript ^5.6`, `@types/node ^22`, `@types/react ^18`, `@types/react-dom ^18`, `tailwindcss ^3.4.19` (stay on v3; v4 has a different config model), `postcss ^8`, `autoprefixer ^10`, `eslint ^8.57`, `eslint-config-next ~14.2.35`, `vitest ^3.2.7`, `@vitejs/plugin-react ^4.3`, `vite-tsconfig-paths ^5`, `jsdom ^25`, `@testing-library/react ^16`, `@testing-library/user-event ^14`, `@testing-library/jest-dom ^6`, `msw ^2.15.0`, `@playwright/test ^1.64.1`, `@axe-core/playwright ^4.14.0`, `supabase ^2.122.0` (CLI, for type generation), `tsx ^4.23.15` (scripts), `dotenv ^16`, `@netlify/plugin-nextjs ^5`, `@netlify/functions ^3` (scheduled functions).

**Scripts:**
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_REF > types/database.types.ts",
  "job:purge-pdfs": "tsx scripts/purge-expired-pdfs.ts",
  "eval:extraction": "tsx evals/run-extraction-eval.ts",
  "eval:chat": "tsx evals/run-chat-eval.ts"
}
```

---

## 2. Configuration files

### `next.config.mjs`
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },                     // Next 14 advisory mitigation (§1.1)
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'], // keep pdf-parse out of the webpack bundle
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false // required by react-pdf / pdfjs-dist in Next.js
    return config
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }] // defined in security.md §3
  },
}
export default nextConfig
```

### `tsconfig.json`
Keep the scaffold file, which already has `"paths": { "@/*": ["./*"] }`, and add `"target": "es2020"` (needed for `Array.prototype.at`, `replaceAll` and BigInt). Imports use `@/lib/...`, `@/components/...` and so on.

### `tailwind.config.ts` / `postcss.config.mjs` / `app/globals.css`
Defined in `design-system-ui.md`.

### `.eslintrc.json`
```json
{ "extends": ["next/core-web-vitals"], "rules": { "no-console": ["warn", { "allow": ["warn", "error"] }] } }
```

### `vitest.config.ts`, `playwright.config.ts`
Defined in `testing.md`.

### `netlify.toml`
Defined in `deployment.md`.

---

## 3. Folder structure

The full annotated tree is in engineering-doc §11. Key rules:
- `app/` holds routes only. Its pages and route handlers are thin and call into `lib/services/*`.
- `lib/` holds framework-agnostic logic: services, repositories, the LLM and PDF layers, validation and constants.
- `components/<area>/` holds UI, with one component per file in PascalCase. `components/ui/` holds design-system primitives.
- `hooks/` holds client hooks; `stores/` holds Zustand stores.
- `types/` holds generated DB types plus domain and API DTO types.
- `scripts/` holds runnable maintenance jobs (tsx). `netlify/functions/` holds scheduled wrappers around those jobs.
- `tests/{unit,integration,e2e,fixtures}` and `evals/`.

---

## 4. Environment variables

`lib/env.ts` validates env with zod. Server and client variables are split so secrets can't reach the browser bundle.

```ts
// lib/env.ts
import 'server-only'
import { z } from 'zod'

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),   // optional locally; logging degrades gracefully
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  USER_ID_HASH_SALT: z.string().min(8),
  LLM_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(300),
  SLACK_ALERT_WEBHOOK_URL: z.string().url().optional(),
  LLM_MODE: z.enum(['live', 'fixture']).default('live'),
})
export const env = serverSchema.parse(process.env)
```

```ts
// lib/public-env.ts  (safe in client code)
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  calibrationWarning: process.env.NEXT_PUBLIC_CALIBRATION_WARNING === 'true',
}
```

A missing or invalid variable makes the first server request throw, and the error names the variable. The variables are listed in `.env.example` at the project root.

---

## 5. Supabase clients — `lib/supabase/`

| File | Export | Used in | Notes |
|---|---|---|---|
| `client.ts` | `createClient()` | Client components | `createBrowserClient<Database>(url, anonKey)` (singleton) |
| `server.ts` | `createClient()` | Server components, route handlers | `createServerClient<Database>` with `cookies()` from `next/headers` (`getAll`/`setAll`; `setAll` wrapped in try/catch for server components) |
| `middleware.ts` | `updateSession(request)` | `middleware.ts` | Refreshes the session cookie and returns `{ response, user }` |
| `admin.ts` | `createAdminClient()` | `llm-usage.repo.ts`, `scripts/*` only | `import 'server-only'`. Uses `SUPABASE_SERVICE_ROLE_KEY` and returns `null` if it is missing. **Never** pass it user-controlled IDs without first checking ownership |

---

## 6. OpenAI client — `lib/llm/client.ts`

```ts
import 'server-only'
import OpenAI from 'openai'
import { env } from '@/lib/env'

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 22_000 })
export const LLM_MODEL = env.OPENAI_MODEL
export const hashUserId = (userId: string) => sha256Hex(env.USER_ID_HASH_SALT + userId) // lib/utils/hash.ts (node:crypto)
```

When `LLM_MODE=fixture`, `lib/llm/fixture-client.ts` is exported instead. It returns deterministic responses from `tests/fixtures/llm/*.json` so E2E tests never call OpenAI.

### Deadline-aware retry — `lib/llm/with-retry.ts`
```ts
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { attempts?: number; backoffMs?: number[]; deadline: number; minRemainingMs?: number },
): Promise<{ result: T; attempts: number }>
```
- Defaults: `attempts = 3`, `backoffMs = [500, 1500]`, `minRemainingMs = 8000`.
- Retries **only** `OpenAI.RateLimitError`, `OpenAI.InternalServerError`, `OpenAI.APIConnectionError`, `OpenAI.APIConnectionTimeoutError`, and `RetryableLLMError`, which our code throws for `finish_reason === 'length'`.
- Before each retry, if `deadline - Date.now() - backoff < minRemainingMs`, it stops and throws `AppError('LLM_UNAVAILABLE')`.
- When retries run out, it throws `AppError('LLM_UNAVAILABLE', 503)`. Non-retryable OpenAI errors (400, 401, 403, 404) throw `AppError('LLM_UNAVAILABLE', 503)` with the cause logged. A 401 means the API key is wrong, which is logged at error level.

---

## 7. API conventions — `lib/api/`

### 7.1 Error model — `errors.ts`
```ts
export type ErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'NOT_FOUND' | 'CONFLICT' | 'ALREADY_PROCESSING'
  | 'RATE_LIMITED' | 'FILE_TOO_LARGE' | 'INVALID_PDF' | 'TOO_MANY_PAGES' | 'SCANNED_PDF' | 'TOO_LONG'
  | 'CHAT_LIMIT_REACHED' | 'LLM_UNAVAILABLE' | 'LLM_REFUSED' | 'LLM_INVALID_OUTPUT' | 'TIMEOUT'
  | 'FORBIDDEN_ORIGIN' | 'INTERNAL_ERROR'

export class AppError extends Error {
  constructor(public code: ErrorCode, public status: number, message?: string, public details?: Record<string, unknown>) {
    super(message ?? DEFAULT_MESSAGES[code])
  }
}
export function fromPostgrestError(e: PostgrestError): AppError // mapping table in database.md §4
```

`DEFAULT_MESSAGES` holds the user-facing copy. This table is the single source of truth:

| Code | HTTP | Message |
|---|---|---|
| VALIDATION_ERROR | 400 | "Please check the highlighted fields." |
| UNAUTHENTICATED | 401 | "Please sign in to continue." |
| NOT_FOUND | 404 | "We couldn't find that contract." |
| CONFLICT | 409 | "This contract can't be changed right now." |
| ALREADY_PROCESSING | 409 | "This contract is already being processed." |
| RATE_LIMITED | 429 | "You're doing that too often. Try again in {minutes} minute(s)." |
| FILE_TOO_LARGE | 413 | "This file is larger than 10 MB." |
| INVALID_PDF | 422 | "We couldn't read this PDF. It may be corrupted or password-protected." |
| TOO_MANY_PAGES | 422 | "ContractIQ supports contracts up to 20 pages." |
| SCANNED_PDF | 422 | "Scanned PDFs are not supported yet. Please upload a PDF with selectable text." |
| TOO_LONG | 422 | "This contract is longer than we support today (15,000 tokens). Longer contract support is coming." |
| CHAT_LIMIT_REACHED | 409 | "This conversation has reached its limit." |
| LLM_UNAVAILABLE | 503 | "Our AI service is busy. Try again in a few minutes." |
| LLM_REFUSED | 422 | "We couldn't analyse this document. Please check it is an NDA or MSA." |
| LLM_INVALID_OUTPUT | 502 | "Something went wrong while analysing. Try again." |
| TIMEOUT | 504 | "Processing took too long. Try again." |
| FORBIDDEN_ORIGIN | 403 | "Request blocked." |
| INTERNAL_ERROR | 500 | "Something went wrong. Try again." |

Wire format: `{ "error": { "code": "SCANNED_PDF", "message": "…", "requestId": "…", "fields"?: { "file": "…" } } }`.

### 7.2 Handler wrapper — `with-api-handler.ts`
```ts
export function withApiHandler<P = {}>(
  handler: (req: NextRequest, ctx: { params: P; requestId: string }) => Promise<Response>,
): (req: NextRequest, ctx: { params: P }) => Promise<Response>
```
- Generates a `requestId` (`crypto.randomUUID()`) and sets the `x-request-id` header.
- Catches `AppError` → JSON envelope with its status. Catches `ZodError` → 400 with `fields`. Any other error → 500, with the stack logged and never returned.
- Adds `Retry-After` when `details.retryAfterSeconds` exists.
- For non-GET methods, calls `checkOrigin(req)` (`lib/api/check-origin.ts`). If an `Origin` header is present and its origin isn't `NEXT_PUBLIC_APP_URL`'s origin → 403 `FORBIDDEN_ORIGIN` ("Request blocked."). This is CSRF defence (security SEC-15).
- Logs one line per request: `{ level, requestId, method, route, status, ms, userId? }`.

Every route file starts with `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`.

### 7.3 Auth — `require-user.ts`
```ts
export async function requireUser(): Promise<{ user: User; supabase: SupabaseClient<Database> }>
```
Creates the server client, calls `supabase.auth.getUser()` (which verifies with Supabase), and throws `AppError('UNAUTHENTICATED', 401)` if there is no user.

### 7.4 Rate limiting — `rate-limit.ts`
```ts
export const RATE_LIMITS = {
  upload:  { max: 20, windowSeconds: 3600 },
  process: { max: 10, windowSeconds: 3600 },
  chat:    { max: 30, windowSeconds: 600 },
} as const
export async function checkRateLimit(supabase, bucket: keyof typeof RATE_LIMITS): Promise<void>
```
Calls `rpc('check_rate_limit', …)`. If `allowed` is false, it throws `AppError('RATE_LIMITED', 429, msg, { retryAfterSeconds })`. If the RPC itself errors, it logs a warning and **allows** the request (fails open).

### 7.5 Validation — `lib/validation/`
One file per resource: `upload.ts`, `custom-terms.ts`, `key-terms.ts`, `chat.ts`, `feedback.ts`, `contracts-query.ts`, `params.ts` (`idParamSchema = z.object({ id: z.string().uuid() })`). The frontend imports the same schemas.

### 7.6 Streaming helpers — `lib/api/stream.ts`
```ts
export function ndjsonStream(run: (emit: (event: object) => void) => Promise<void>): Response
// Content-Type: application/x-ndjson; Cache-Control: no-cache, no-transform; X-Accel-Buffering: no

export function sseStream(run: (send: (event: string, data: object) => void) => Promise<void>): Response
// Content-Type: text/event-stream; frames are `event: <name>\ndata: <json>\n\n`
```
Both use a `ReadableStream` with `TextEncoder`. `run` errors are caught and emitted as a final error event (`{step:'error',…}` or `event: error`). The stream always closes.

Client-side readers live in `lib/utils/read-ndjson.ts` and `lib/utils/read-sse.ts`. Each is an async generator over `response.body`.

### 7.7 Response DTOs
API JSON uses camelCase. Repositories map snake_case rows to DTOs with mappers in `lib/db/mappers.ts` (`toContractDTO`, `toKeyTermDTO`, `toChatMessageDTO`). DTO types live in `types/api.ts`.

---

## 8. Logging — `lib/utils/logger.ts`
`logger.info|warn|error(message, fields)` writes single-line JSON to stdout/stderr, which Netlify captures.

**Never log** contract text, prompts, chat content, API keys or JWTs. Log IDs, counts, codes and timings only.

---

## 9. Constants — `lib/constants/`
- `limits.ts`:
  - `MAX_FILE_SIZE_BYTES = 10_485_760`
  - `MAX_PAGES = 20`
  - `MIN_WORDS = 100`
  - `MAX_CONTRACT_TOKENS = 15_000`
  - `MAX_CUSTOM_TERMS = 5`
  - `MAX_CHAT_MESSAGES = 200`
  - `MAX_CHAT_INPUT_CHARS = 2000`
  - `LOW_CONFIDENCE = 50`
  - `HIGH_CONFIDENCE = 80`
  - `SIGNED_URL_TTL_SECONDS = 3600`
  - `STALE_PROCESSING_MS = 120_000`
  - `PROCESS_DEADLINE_MS = 24_000`
  - `LLM_TIMEOUT_MS = 22_000`
- `standard-terms.ts`: see `key-term-extraction.md` §3.
- `term-glossary.ts`: see `results-page.md`.

---

## 10. Health route — `app/api/health/route.ts`
`GET /api/health` needs no auth. It runs `select id from profiles limit 1` through the admin client if one is available, otherwise `supabase.auth.getSession()`, as a connectivity probe.
- Healthy: 200 `{ status: 'ok', db: 'ok', time }`
- Failure: 503 `{ status: 'degraded', db: 'down' }`

---

## 11. Root layout & providers
- `app/layout.tsx`:
  - loads the Inter Display font (`design-system-ui.md`)
  - sets `<html lang="en">`
  - sets metadata `title: { default: 'ContractIQ', template: '%s · ContractIQ' }` and the description
  - renders `<Providers>`
- `app/providers.tsx` (`'use client'`):
  - `QueryClientProvider` with defaults `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: true`
  - `<Toaster richColors position="top-right" />`
- `app/not-found.tsx` and `app/error.tsx`: design-system styled with a "Go to dashboard" link.

---

## 12. Acceptance criteria
- **AC-FND-01:** `npm install && npm run build` succeeds with zero TypeScript errors. `npm ls next` reports 14.2.35 (or the approved upgrade). The repo contains no `'use server'` directive, no `pages/` directory and no `rewrites()`, and `images.unoptimized` is `true` (§1.1).
- **AC-FND-02:** If `OPENAI_API_KEY` is removed, the first API call fails with a log line naming the missing variable.
- **AC-FND-03:** `GET /api/health` returns 200 `{status:"ok"}` against the configured Supabase project.
- **AC-FND-04:** Any route that throws `new AppError('NOT_FOUND', 404)` returns the envelope with a `requestId` that matches the `x-request-id` header.
- **AC-FND-05:** Importing `lib/supabase/admin.ts` or `lib/llm/client.ts` from a client component fails the build.
- **AC-FND-06:** `checkRateLimit` throws `RATE_LIMITED` with `retryAfterSeconds`, and the response carries a `Retry-After` header.
- **AC-FND-07:** `withRetry` retries a 429 twice and then throws `LLM_UNAVAILABLE`. It does not retry a 400. It does not start a retry when less than 8 s remain before the deadline. (Unit tests.)
