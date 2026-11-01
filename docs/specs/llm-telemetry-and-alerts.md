# Spec — Rate Limiting, LLM Telemetry & Alerts (S14)

**Source:** PRD §3 cost metric (≤ $0.25 per analysis), §5 reliability, external-dependency risks (OpenAI pricing, rate limits), §10 monitoring · engineering-doc §6.3, §8.7, §8.9 · **Release:** v1.0 (logging starts in v0.2)

## 1. Goal
- Protect the OpenAI budget and the app with per-user rate limits.
- Record the tokens, cost, latency and outcome of every OpenAI call.
- Alert the team when monthly spend reaches 80 % of budget, or when the 7-day correction rate goes above 12 %.

## 2. Files
| File | Purpose |
|---|---|
| `lib/api/rate-limit.ts` | `checkRateLimit()` (foundation §7.4) |
| `lib/llm/cost.ts` | `PRICING`, `computeCost()` |
| `lib/db/llm-usage.repo.ts` | `logUsage()` (service role) |
| `lib/jobs/llm-cost-alert.ts`, `lib/jobs/correction-rate-alert.ts` | Job logic |
| `lib/utils/slack.ts` | `postSlack(text)` |
| `netlify/functions/llm-cost-alert.ts`, `netlify/functions/correction-rate-alert.ts` | Scheduled wrappers |
| `scripts/llm-cost-report.ts` | `npx tsx scripts/llm-cost-report.ts` prints month-to-date cost locally |

## 3. Rate limits
| Bucket | Limit | Applied in |
|---|---|---|
| `upload` | 20 per hour | `POST /api/contracts/upload` |
| `process` | 10 per hour | `POST /api/contracts/[id]/process` (not charged when it returns an already-completed result) |
| `chat` | 30 per 10 minutes | `POST /api/contracts/[id]/chat` |

Mechanism: `rpc('check_rate_limit', { p_bucket, p_max, p_window_seconds })` returns `{ allowed, retry_after_seconds }`.
- Not allowed → 429 `RATE_LIMITED`, message "You're doing that too often. Try again in {ceil(s/60)} minute(s).", and the `Retry-After: {s}` header.
- RPC failure → log a warning and allow the request (fail open).

Frontend:
- `apiFetch` maps a 429 to a toast with that message.
- Mutation buttons for the same action are disabled until `Date.now() + Retry-After`. The time is stored in a small Zustand slice `useCooldownStore`.

## 4. Cost model — `lib/llm/cost.ts`
```ts
// USD per 1M tokens. Verify against https://openai.com/api/pricing before launch; update with a PR.
export const PRICING: Record<string, { input: number; cachedInput: number; output: number }> = {
  'gpt-4o': { input: 2.50, cachedInput: 1.25, output: 10.00 },
}
export function computeCost(model: string, usage: { prompt_tokens: number; completion_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number } }): number {
  const p = PRICING[model] ?? PRICING['gpt-4o']
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0
  const uncached = Math.max(0, usage.prompt_tokens - cached)
  return round6((uncached * p.input + cached * p.cachedInput + usage.completion_tokens * p.output) / 1_000_000)
}
```

## 5. Usage logging — `logUsage()`
```ts
export async function logUsage(e: {
  userId: string; contractId: string | null; operation: 'extraction' | 'chat'; model: string
  usage: OpenAI.CompletionUsage | null; latencyMs: number; attempts: number; success: boolean; finishReason: string | null
}): Promise<void>
```
- Uses `createAdminClient()`. If that returns `null` (no `SUPABASE_SERVICE_ROLE_KEY`), it logs a warning `llm_usage_skipped` once per process and returns.
- Inserts `{ user_id, contract_id, operation, model, input_tokens: prompt_tokens, output_tokens: completion_tokens, cached_input_tokens, cost_usd, latency_ms, attempts, success, finish_reason }`.
- Never throws. Errors are logged as `llm_usage_insert_failed`.
- **Never** stores prompts, contract text or chat content.
- `usage` with multiple attempts: sum the usage of all attempts (each attempt is billed).
- Streaming chat: usage comes from the final chunk (`stream_options.include_usage`).

## 6. Alerts

### 6.1 Monthly cost — `llm-cost-alert` (daily 08:00 UTC)
1. `select sum(cost_usd) from llm_usage where created_at >= date_trunc('month', now())`.
2. If `sum >= 0.8 * LLM_MONTHLY_BUDGET_USD`, post to Slack: ":warning: ContractIQ OpenAI spend is ${sum} (≥ 80 % of ${budget}) for {Month}."
3. Also post average cost per extraction month-to-date when it is above $0.20 (PRD cost target).

### 6.2 Correction rate — `correction-rate-alert` (daily 08:00 UTC)
1. Take contracts processed in the last 7 days: `edited = count(key_terms where is_edited)` and `total = count(key_terms)` for those contracts.
2. If `total >= 50` and `edited / total > 0.12`, post: ":warning: Correction rate {x}% over the last 7 days (threshold 12 %). Trigger a prompt review."

Both jobs:
- No-op with a log line if the Slack URL or the service key is missing.
- Scheduled through `export const config = { schedule: '0 8 * * *' }`.

### 6.3 External limits (manual setup)
- OpenAI dashboard → Project → Limits: monthly budget = 120 % of `LLM_MONTHLY_BUDGET_USD`, with an email alert at 80 %.
- Uptime Robot on `GET /api/health` every 5 min → team Slack.

## 7. Edge cases
| Case | Behaviour |
|---|---|
| Unknown model ID in `OPENAI_MODEL` | Priced as gpt-4o; warning logged once |
| Missing `usage` (aborted stream) | Row logged with zero tokens, `success=false` |
| Clock skew across function instances | Windows come from the DB `now()`, so they are consistent |
| A user behind shared NAT | Limits are per user ID, not per IP |

## 8. Acceptance criteria
- **AC-TEL-01:** Every extraction and every chat answer writes exactly one `llm_usage` row with non-zero tokens and `cost_usd > 0` (when the service key is configured).
- **AC-TEL-02:** With the service key missing, extraction and chat still succeed, and a single `llm_usage_skipped` warning is logged.
- **AC-TEL-03:** `computeCost('gpt-4o', {prompt_tokens: 19000, completion_tokens: 2500, prompt_tokens_details: {cached_tokens: 4000}})` = 0.0675.
- **AC-TEL-04:** Limits hit at the 21st upload, 11th process and 31st chat in their windows, with a 429 + `Retry-After` and the toast copy.
- **AC-TEL-05:** The cost alert posts once when month-to-date spend ≥ 80 % of budget (unit test with a fake client and a fake Slack).
- **AC-TEL-06:** The correction alert fires at 13 % with ≥ 50 terms, and does not fire at 11 % or with < 50 terms.
- **AC-TEL-07:** No `llm_usage` row contains contract or chat text (the schema has no such column).

## 9. Tests
- Unit: `computeCost`, both alert jobs (thresholds, missing config), `logUsage` (no admin client → no throw).
- Integration: rate-limit RPC boundaries per bucket.
