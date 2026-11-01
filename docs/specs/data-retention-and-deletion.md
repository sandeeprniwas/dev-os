# Spec — Contract Deletion & Data Retention (S13)

**Source:** PRD §5 (90-day PDF retention, user deletion, GDPR), §11 Responsible AI · engineering-doc §4.11–4.12, §7.6 · **Release:** v1.0

> **Change from engineering-doc:** the plan purged PDFs with a `pg_cron` job running `DELETE FROM storage.objects`. Supabase blocks direct deletes on its storage tables (the file wouldn't be removed from the bucket), so retention runs as a **scheduled job that calls the Storage API** with the service role. `pg_cron` is not needed.

## 1. Goal
- Users can permanently delete a contract and **all** associated data at any time.
- Uploaded PDFs are removed automatically 90 days after the contract was last opened. The extracted text and results remain until the user deletes the contract.

## 2. Files
| File | Purpose |
|---|---|
| `app/api/contracts/[id]/route.ts` | `DELETE` (same file as `GET`) |
| `lib/services/contract.service.ts` | `deleteContract()` |
| `components/contracts/DeleteContractDialog.tsx` | Confirmation UI |
| `hooks/use-delete-contract.ts` | Mutation |
| `lib/jobs/purge-expired-pdfs.ts` | Job logic (pure, testable) |
| `scripts/purge-expired-pdfs.ts` | CLI entry: `npm run job:purge-pdfs` (local and manual) |
| `netlify/functions/purge-expired-pdfs.ts` | Scheduled wrapper (`schedule: '0 3 * * *'`) |

## 3. Manual deletion

### 3.1 API — `DELETE /api/contracts/[id]`
- **Auth:** required.
- **Logic:**
  1. Validate `id`. Select `id, file_path` (RLS) → 404 if missing.
  2. If `file_path` is set, call `supabase.storage.from('contracts').remove([file_path])` with the user client (the storage DELETE policy allows the owner). Errors are logged as `storage_delete_failed` with `{contractId, path}` and **do not block** the row delete.
  3. `delete from contracts where id = $1`. The cascade removes `key_terms`, `custom_key_terms`, `chat_sessions` → `chat_messages` and `user_feedback`. `llm_usage.contract_id` becomes NULL; cost records are kept with no content.
  4. 204.
- **Errors:** 400, 401, 404.

### 3.2 UI — `DeleteContractDialog`
- Radix `AlertDialog`. Title: `Delete "{title}"?`
- Body: "This permanently deletes the contract, its extracted terms and its chat history. This can't be undone."
- Buttons: **Cancel** (secondary, initial focus) and **Delete** (danger, `loading`).
- On success: toast "Contract deleted". On the results page `router.replace('/dashboard')`; on the dashboard the list is invalidated.
- `useDeleteContract()` `onSuccess`: `removeQueries(['contract', id])`, `removeQueries(['chat', id])`, `invalidateQueries(['contracts'])` and `invalidateQueries(['dashboard-stats'])`.

## 4. Automatic PDF retention

### 4.1 Job — `lib/jobs/purge-expired-pdfs.ts`
```ts
export async function purgeExpiredPdfs(admin: SupabaseClient<Database>, now = new Date(), batchSize = 100):
  Promise<{ scanned: number; purged: number; failed: number }>
```
1. `cutoff = now - 90 days`.
2. Loop:
   - `select id, file_path from contracts where file_path is not null and last_accessed_at < cutoff order by last_accessed_at limit batchSize`. Stop when 0 rows are returned.
   - Run `admin.storage.from('contracts').remove(paths)` (up to 100 per call).
   - Run `update contracts set file_path = null where id in (successfully removed ids)`. Supabase `remove()` returns the objects it deleted. A path missing from storage still has `file_path` set to null.
   - Failed paths are counted and logged, and are retried on the next run.
3. Log `{ job: 'purge-expired-pdfs', scanned, purged, failed, ms }`.

### 4.2 Entry points
- **Local / manual:** `npm run job:purge-pdfs`. It runs `scripts/purge-expired-pdfs.ts`, which loads `.env.local` with `dotenv` and needs `SUPABASE_SERVICE_ROLE_KEY`. Use `--dry-run` to print counts only.
- **Production:** `netlify/functions/purge-expired-pdfs.ts`:
  ```ts
  import type { Config } from '@netlify/functions'
  export default async () => { const admin = createAdminClient(); if (!admin) return; await purgeExpiredPdfs(admin) }
  export const config: Config = { schedule: '0 3 * * *' }   // daily 03:00 UTC
  ```

### 4.3 Effect on the app
`GET /api/contracts/[id]` returns `signedUrl: null`, and the viewer shows the text fallback with "The original PDF isn't available, so we're showing the extracted text." Results and chat keep working.

`last_accessed_at` is refreshed by `GET /api/contracts/[id]` (throttled to once per 10 minutes), so contracts the user keeps opening never lose their PDF.

## 5. GDPR account deletion (operator process, MVP)
No in-app account deletion in the MVP. On request, an operator:
1. Runs `supabase.auth.admin.deleteUser(userId)`. The cascades remove `profiles`, `contracts` and all child rows, `llm_usage` and `rate_limits`.
2. Lists and removes `contracts/{userId}/` objects with the admin Storage API (`list` + `remove`).

This is documented in `deployment.md` §7 (runbook).

## 6. Edge cases
| Case | Behaviour |
|---|---|
| Delete while processing | Allowed. The in-flight process fails its writes (FK) and logs; nothing is left behind |
| Storage remove fails on delete | Row still deleted. The orphan object is logged with its path for manual clean-up, and the weekly orphan check in the runbook lists objects in `contracts/` with no matching `file_path` |
| Job runs without the service key | Exits with a warning; nothing is deleted |
| Very many expired files | Batched in 100s; Netlify's scheduled-function limit (30 s) is respected by stopping after 25 s and continuing next run |
| User deletes, then presses Back to the results URL | 404 page |

## 7. Acceptance criteria
- **AC-RET-01:** Deleting a contract removes its PDF from Storage and every row in `contracts`, `key_terms`, `custom_key_terms`, `chat_sessions`, `chat_messages` and `user_feedback` for that contract. `llm_usage.contract_id` becomes NULL.
- **AC-RET-02:** The confirmation dialog must be confirmed. Cancel (the default focus) does nothing.
- **AC-RET-03:** With a contract whose `last_accessed_at` is set 91 days ago, `npm run job:purge-pdfs` deletes its storage object and sets `file_path = NULL`. A contract accessed 89 days ago is untouched.
- **AC-RET-04:** After the purge, the results page still shows terms, chat and the text viewer.
- **AC-RET-05:** User B cannot delete user A's contract (404) or storage object.

## 8. Tests
- Unit: `purgeExpiredPdfs` with a fake admin client (cutoff math, batching, partial failures, dry-run).
- Integration: DELETE cascade verification, foreign → 404.
- E2E: delete from the dashboard (`dashboard.spec.ts`).
