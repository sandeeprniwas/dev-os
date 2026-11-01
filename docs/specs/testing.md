# Spec — Testing & Evaluation Strategy

**Source:** PRD §10 Evaluation Strategy, §11 launch criteria, §3 internal risks · engineering-doc §13 · **Used in:** Stage 4 (tests written alongside each feature) and Stage 5 (full suite)

## 1. Layers & tools
| Layer | Tool | Scope | Runs |
|---|---|---|---|
| Unit | Vitest 3 + React Testing Library + jsdom | `lib/**`, hooks, components | Every commit / CI |
| Integration | Vitest (node env) against a **Supabase test project** | Route handlers, RPCs, RLS, storage | CI + locally |
| E2E | Playwright 1.64 (Chromium, Firefox, Pixel 7 viewport) + `@axe-core/playwright` | User flows, a11y | CI (fixture LLM mode) |
| LLM eval | `tsx` scripts in `evals/` calling OpenAI live | Accuracy, calibration, groundedness | Manually / release gate |

**Coverage targets:** `lib/**` ≥ 80 % lines, components ≥ 70 %, overall ≥ 60 % (v8 coverage via Vitest).

## 2. Configuration
- `vitest.config.ts`:
  - `plugins: [react(), tsconfigPaths()]`
  - `test.environment: 'jsdom'`, with `environmentMatchGlobs: [['tests/integration/**', 'node']]`
  - `setupFiles: ['tests/setup.ts']`, where `setup.ts` imports `@testing-library/jest-dom` and sets up MSW for client tests
  - `coverage.provider: 'v8'`
- `playwright.config.ts`:
  - `webServer: { command: 'npm run build && npm run start', port: 3000, env: { LLM_MODE: 'fixture' } }`
  - `use.baseURL = 'http://localhost:3000'`
  - projects `chromium`, `firefox`, `mobile` (Pixel 7)
  - `retries: 1` in CI
- **Test Supabase project:** a separate free project, `ContractIQ_Test`, with the same `supabase-schema.sql` and "Confirm email" off. Credentials go in `.env.test.local` (git-ignored). If Docker is available, `supabase start` (local stack) can be used instead. The integration suite reads `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY` and `TEST_SUPABASE_SERVICE_ROLE_KEY`.
- **Test users:** created per run with the admin API (`auth.admin.createUser({ email: 'ciq-test-<run>-a@example.com', password, email_confirm: true })`) and deleted in `afterAll`.

## 3. Unit test inventory (minimum)
| Module | Cases |
|---|---|
| `lib/pdf/extract-text` | 6-page NDA, 12-page MSA, scanned → low words, encrypted → throws, 21 pages, literal `[PAGE 3]` stripped |
| `lib/pdf/page-markers` | build/split round-trip, empty page, `normalise` (quotes, dashes, soft hyphens), `findSentencePage` exact/fuzzy/none/wrong page |
| `lib/llm/tokens` | Known strings → known counts |
| `lib/llm/validators/extraction` | ≥ 15 cases (extraction spec §12) |
| `lib/llm/prompts/*` | Message order, targets JSON-encoded, custom terms appended, history truncation |
| `lib/llm/classify-query` | 12 cases |
| `lib/llm/citations` | Page extraction and range filter; `ensurePrefix` incl. NOT_FOUND variants |
| `lib/llm/with-retry` | 429 retry, 400 no retry, deadline cut-off, length → retry |
| `lib/llm/cost` | AC-TEL-03 |
| `lib/auth/redirect` | 10 open-redirect cases |
| `lib/validation/*` | Each schema's edge cases |
| `lib/jobs/*` | Purge batching, alert thresholds |
| Components | `ConfidenceBadge` boundaries, `LowConfidenceWarning`, `EditableTermValue`, `SourceSentenceDisclosure`, `ChatMessageBubble` citations, `PdfDropzone` rejection copy, `ContractsTable` aria-sort |

## 4. Integration test inventory
| Suite | Covers |
|---|---|
| `upload.int.test.ts` | Happy path (text, markers, storage path); each 4xx code with no row created; storage failure → 201 `storageAvailable:false`; rate limit 21st → 429 |
| `custom-terms.int.test.ts` | Replace semantics, 6 → 400, duplicate → 400, completed → 409, foreign → 404 |
| `process.int.test.ts` (fake OpenAI) | Success; 503×3 → error state; length → retry; invalid JSON → repair; refusal; concurrent claim 409; completed → immediate done; key_terms idempotent on retry |
| `contract-detail.int.test.ts` | Owned, foreign 404, stale processing, signed URL null on storage error, `last_accessed_at` throttle |
| `edit.int.test.ts` | First/second edit original preserved; unchanged value; column grant blocks `confidence_score` updates |
| `chat.int.test.ts` (fake streaming OpenAI) | Persisted rows; mid-stream error; retryOfMessageId; 200 limit; foreign 404 |
| `feedback.int.test.ts` | Upsert once |
| `delete.int.test.ts` | Cascade + storage removal; `llm_usage.contract_id` null |
| **`rls.int.test.ts`** (critical, PRD risk) | Users A and B: B's client attempts select/update/delete on every table for A's rows (0 rows / error), inserts with `user_id = A` (rejected), RPCs on A's IDs (not found), storage download/list/delete of A's objects (denied), every API route with A's IDs (404) |
| `schema.int.test.ts` | Every public table has RLS on; `anon` select returns permission errors |

## 5. E2E inventory (Playwright, `LLM_MODE=fixture`)
| Spec | Flow |
|---|---|
| `landing.spec.ts` | Hero, CTAs, footer, axe |
| `auth.spec.ts` | Sign up → dashboard empty state; sign out; sign in; redirectTo round-trip; wrong password |
| `contract-review.spec.ts` | New → NDA → upload fixture → 10 preview terms → add custom term → process (3 steps) → results: colours, ⚠ on low term, auto-scroll to the low term, page jump, Why?, disclaimer, mark complete, feedback |
| `edit-term.spec.ts` | Edit → Edited badge persists after reload; Esc cancels |
| `chat.spec.ts` | Suggested question → streamed answer with chip → chip navigates → reload → history present; not-found answer |
| `dashboard.spec.ts` | Stats, sort by name/type/date, open row, delete with confirm |
| `errors.spec.ts` | Scanned PDF, 11 MB PDF, LLM failure fixture → Try again → success, text-viewer fallback when storage is absent |
| `a11y.spec.ts` | axe on all pages; keyboard-only review flow |
| `onboarding.spec.ts` | Tour once, skip persists |

**Fixtures** (`tests/fixtures/`):
- PDFs: `nda-6p.pdf`, `msa-12p.pdf`, `scanned-2p.pdf`, `encrypted.pdf`, `21-pages.pdf`, `11mb.pdf` (generated by `scripts/make-fixtures.ts`)
- LLM fixtures: `llm/extraction-nda.json`, `llm/extraction-msa.json`, `llm/chat-*.json` (includes a low-confidence term and a not-found answer)

## 6. LLM evaluation (PRD §10)
| Eval | Script | Dataset | Target | Cadence |
|---|---|---|---|---|
| Extraction F1 (term value match by SME rubric: exact/normalised or judged equivalent) | `npm run eval:extraction` | `evals/datasets/{nda,msa}` — 30 NDA + 20 MSA SME-labelled (CUAD-derived until SME set exists) | ≥ 88 % NDA, ≥ 85 % MSA (beta ≥ 82 %) | Every release / prompt change |
| Page accuracy | same | same | ≥ 92 % | Every release |
| Custom-term F1 | same, `--custom` | 10 terms × 15 contracts | ≥ 80 % | Every release |
| Calibration | same, outputs bucket table | same | each 10 % bucket within ±0.10; ≥ 0.15 → set the calibration banner flag | Monthly |
| Chat groundedness | `npm run eval:chat` | 50 Q&A pairs; expert labels Grounded / Hallucinated / Correct-not-found | ≤ 5 % hallucinated | Monthly |
| "Cannot find" regression | `npm run eval:chat -- --not-found` | 20 absent-topic questions | 100 % exact NOT_FOUND | Every deploy (nightly) |
| Injection | `npm run eval:extraction -- --injection` | 5 contracts with embedded instructions | Output unaffected; verification holds | Every release |
| Latency | both scripts record timings | 20 contracts of 15–20 pages | extraction P95 ≤ 30 s, chat P95 ≤ 15 s | Every release |

Output: `evals/results/<date>-<promptVersion>.json` plus a CSV with the PRD spreadsheet columns `Contract_ID | Contract_Type | Term_Name | Expected_Value | AI_Extracted_Value | Expected_Page | AI_Page | Confidence_Score | F1_Match | Expert_Rating | Notes`.

Eval runs cost real money: about $0.07 × 50 contracts ≈ $3.50 per extraction run.

## 7. CI (`.github/workflows/ci.yml`)
1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. Guard greps (no `'use server'`, no `dangerouslySetInnerHTML`, no `pages/`)
5. `npm test -- --coverage`
6. Integration (needs test-project secrets)
7. `npx playwright install --with-deps && npm run test:e2e`
8. `npm run build`

Node 22.

## 8. Acceptance criteria (Stage 5 exit)
- **AC-TEST-01:** All unit, integration and E2E suites pass locally and in CI.
- **AC-TEST-02:** Coverage targets in §1 are met.
- **AC-TEST-03:** `rls.int.test.ts` passes with no skipped cases.
- **AC-TEST-04:** The latest eval run meets the beta gates (F1 ≥ 82 %, latency ≤ 45 s P95) before beta, and the public gates (§6) before launch.
