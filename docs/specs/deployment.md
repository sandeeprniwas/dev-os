# Spec — Local Setup, Deployment & Operations

**Source:** PRD §6 hosting (Netlify + Supabase), §11 monitoring and incident plan, roadmap dependencies · engineering-doc §6.1, §6.6 · **Used in:** Stage 3/4 (local), Stage 6 (deploy)

## 1. Local development (lab: `http://localhost:3000`)

### 1.1 Prerequisites
- Node.js **22 LTS or newer** (`node -v`); required by `openai@7`
- A Supabase project (current: `ContractIQ_FinalProject`, ref `lrllzmcjotybsaempjip`)
- An OpenAI API key with GPT-4o access

### 1.2 One-time setup
1. **Database:** run `contractiq/supabase/database.sql` in the Supabase SQL Editor (database spec §1).
2. **Auth settings** (auth spec §2):
   - Site URL `http://localhost:3000`
   - Redirect URL `http://localhost:3000/auth/callback`
   - "Confirm email" **off** for the lab
3. **Env:** `contractiq/.env.local` holds the values for every variable in `contractiq/.env.example`. Required for full functionality:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (the **service_role / secret** key, not the anon key)
   - `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4o`
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `USER_ID_HASH_SALT` (random, e.g. `openssl rand -hex 32`)
4. **Fonts:** download Inter Display `.woff2` files into `public/fonts/` (design-system spec §3).
5. Run `npm install`, then `npm run db:types` (after `npx supabase login`).

### 1.3 Run
`npm run dev` → `http://localhost:3000`. Other commands: `npm test`, `npm run test:e2e`, `npm run job:purge-pdfs -- --dry-run`.

### 1.4 Smoke test (local)
1. Sign up → empty dashboard.
2. Upload `tests/fixtures/nda-6p.pdf` as NDA → 10 preview terms → add "Non-compete radius" → Process → results in < 30 s.
3. Click a page reference → the viewer jumps and highlights.
4. Ask "How long does confidentiality last?" → cited answer.
5. Edit a term → Edited badge → reload → persists.
6. Delete the contract → dashboard empty again.

## 2. Netlify configuration — `netlify.toml`
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "22"
  NEXT_TELEMETRY_DISABLED = "1"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  node_bundler = "esbuild"
  included_files = ["node_modules/pdf-parse/**", "node_modules/pdfjs-dist/build/**"]
```
- **Function timeout:** raise the synchronous function limit to **26 s** (Netlify site settings / support request on the paid plan). Without it, `/process` and `/chat` are cut off at 10 s.
- **Scheduled functions:** `netlify/functions/purge-expired-pdfs.ts` (03:00 UTC), `llm-cost-alert.ts` and `correction-rate-alert.ts` (08:00 UTC). They declare `export const config = { schedule }`.
- **Environment variables** (Site settings → Environment): every variable in `.env.example` with production values. `NEXT_PUBLIC_APP_URL` is the production URL. `LLM_MODE` must be unset or `live`.

## 3. Supabase production settings
- Upgrade to the **Pro plan** before beta (PRD dependency; the free tier fills at about 200 contracts).
- Auth: Site URL = production domain; redirect URLs include production `/auth/callback`; "Confirm email" **on**; custom SMTP configured (built-in mail is rate-limited).
- Re-run `supabase-schema.sql` (idempotent) on the production project.
- Storage alert at 70 % usage (PRD).

## 4. Stage 6 deployment checklist
| # | Step | Verification |
|---|---|---|
| 1 | Decide on the Next.js upgrade (foundation §1.1) | Decision recorded |
| 2 | All env vars set in Netlify | `GET /api/health` 200 on the deploy preview |
| 3 | `npm run build` locally with production env | No errors |
| 4 | Deploy preview → run the §1.4 smoke test on the preview URL | All steps pass |
| 5 | Promote to production | — |
| 6 | Production smoke test (§1.4) + `curl -I` security headers | Pass |
| 7 | Uptime Robot monitor on `/api/health` → Slack | Alert test fires |
| 8 | OpenAI project budget + Slack webhook configured | Test alert posts |

## 5. Monitoring
| Signal | Source |
|---|---|
| Function errors, latency | Netlify function logs (JSON lines from `logger`) |
| DB / storage health | Supabase dashboard, `/api/health` |
| OpenAI usage and cost | OpenAI dashboard + `llm_usage` + daily cost alert |
| Quality drift | Correction-rate alert, monthly eval |
| Uptime (99.5 % SLA) | Uptime Robot |

## 6. Incident response (PRD §11)
- **P0** (data exposure or full outage): in-app banner, status page updated within 30 minutes, and an email to affected users within 1 hour.
- **P1** (degraded): in-app banner within 2 hours.
- **OpenAI outage:** users see "Our AI service is busy…" with Try again, and contracts stay retryable (`status='error'`). Nothing else is required.

## 7. Operations runbook
| Task | How |
|---|---|
| GDPR account deletion | Retention spec §5 |
| Orphaned storage objects | List `contracts/` objects (admin Storage API) whose path has no matching `contracts.file_path`, then remove them |
| Rotate OpenAI key | Create a new key → update Netlify env → redeploy → revoke the old key |
| Rotate Supabase keys | Supabase → API → rotate → update env → redeploy |
| Change the model | Set `OPENAI_MODEL` + add pricing to `lib/llm/cost.ts` + run evals first |
| Prompt change | PR updating `lib/llm/prompts/*` + version bump + eval run attached |

## 8. Acceptance criteria
- **AC-DEP-01:** A fresh clone runs locally by following §1 only.
- **AC-DEP-02:** The production deploy passes every step of §4.
- **AC-DEP-03:** Scheduled functions appear in Netlify with the expected schedules, and the first run logs a summary line.
