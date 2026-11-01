# Spec — Upload & Text Extraction (S4)

**Source:** PRD Flow 3 steps 1–2, US-002, FR-02, FR-03, §5 constraints · engineering-doc §4.4, §9.1 · **Release:** v0.2

## 1. Goal
Accept an NDA/MSA PDF, validate it, extract its text **once** with `[PAGE N]` markers into `contracts.contract_text`, and store the PDF in Supabase Storage on a best-effort basis. Everything downstream (extraction, chat, text viewer) reads the stored text and never re-downloads the PDF.

## 2. Files
| File | Purpose |
|---|---|
| `app/(app)/contracts/new/page.tsx` | Upload screen (client page in a server shell) |
| `app/api/contracts/upload/route.ts` | `POST` handler |
| `lib/services/contract.service.ts` | `createContractFromUpload()` |
| `lib/pdf/extract-text.ts` | `extractText(buffer)` |
| `lib/pdf/page-markers.ts` | `buildMarkedText`, `splitPages`, `normalise`, `findSentencePage` (shared with S6/S8) |
| `lib/pdf/pdf-parse.d.ts` | Module declaration for `pdf-parse/lib/pdf-parse.js` |
| `lib/llm/tokens.ts` | `countTokens(text)` (gpt-tokenizer, o200k_base) |
| `lib/utils/slugify.ts` | Filename → safe slug |
| `lib/validation/upload.ts` | `uploadFieldsSchema` |
| `lib/db/contracts.repo.ts` | `insertContract`, `setFilePath` |
| `components/upload/{ContractTypeSelect,PdfDropzone}.tsx` | UI |
| `stores/upload-store.ts` | Zustand store for the whole new-contract flow |
| `hooks/use-upload-contract.ts` | Upload mutation |

## 3. User flow
1. The user opens `/contracts/new` from "Review a Contract".
2. They pick a **contract type** (required). The `KeyTermPreviewCard` (custom-terms spec) immediately lists the standard terms for that type.
3. They drop or pick a PDF. The client pre-checks type and size, so files that are too large are rejected instantly.
4. The upload starts. The dropzone shows the filename and a spinner, and the preview card shows step ① "Extracting text…".
5. On success: ① shows ✓ "Text extracted · 6 pages", the dropzone shows the file summary with "Change file", and "+ Add Key Term" and "Process Contract" are enabled.
6. On failure: an inline error under the dropzone plus "Choose another file". Nothing is stored server-side.

"Change file" after a successful upload deletes the just-created contract (`DELETE /api/contracts/[id]`, fire-and-forget) and resets the store to step `select` with the chosen type kept.

## 4. API — `POST /api/contracts/upload`

**Auth:** required · **Rate limit:** `upload` (20/hour) · **Body:** `multipart/form-data`

| Field | Rule |
|---|---|
| `file` | File; required |
| `contractType` | `'nda' \| 'msa'`; required |
| `title` | optional string, trimmed, 1–200 chars |

**Processing steps.** Order matters: cheapest checks first, and nothing is persisted until every check passes.

| # | Step | Failure |
|---|---|---|
| 1 | `requireUser()` | 401 `UNAUTHENTICATED` |
| 2 | `checkRateLimit(supabase,'upload')` | 429 `RATE_LIMITED` |
| 3 | Reject if `Content-Length` > 10.5 MB (the multipart overhead allowance) before parsing | 413 `FILE_TOO_LARGE` |
| 4 | `await req.formData()`, then validate fields with zod. `file` must be `instanceof File` | 400 `VALIDATION_ERROR` |
| 5 | `file.size === 0` → INVALID_PDF. `file.size > 10_485_760` → FILE_TOO_LARGE | 422 / 413 |
| 6 | `buffer = Buffer.from(await file.arrayBuffer())`. The first 5 bytes must be `%PDF-` | 422 `INVALID_PDF` |
| 7 | `extractText(buffer)` (§5). Throws on encrypted, corrupt or unparseable input | 422 `INVALID_PDF` |
| 8 | `pageCount > 20` | 422 `TOO_MANY_PAGES` |
| 9 | `wordCount < 100` | 422 `SCANNED_PDF` |
| 10 | `tokenCount = countTokens(markedText)`, which must be ≤ 15,000 | 422 `TOO_LONG` |
| 11 | `contractId = crypto.randomUUID()`. `title = fields.title ?? stripExt(file.name)` (truncated to 200). Insert the row with status `uploaded` | 500 |
| 12 | `path = ${user.id}/${contractId}/${slugify(stripExt(file.name)) || 'contract'}.pdf`. Upload with `supabase.storage.from('contracts').upload(path, buffer, { contentType: 'application/pdf', upsert: false })` | non-blocking |
| 13 | On success: `update contracts set file_path = path`. On failure: `logger.warn('storage_upload_failed', { contractId, code })` and `storageAvailable = false` | — |
| 14 | 201 response | — |

**Response 201**
```json
{
  "contract": {
    "id": "6f1c…", "title": "Acme Mutual NDA", "contractType": "nda", "status": "uploaded",
    "pageCount": 6, "wordCount": 2310, "tokenCount": 3120, "storageAvailable": true,
    "createdAt": "2026-10-25T10:12:00.000Z"
  }
}
```

**Error examples:** `413 {"error":{"code":"FILE_TOO_LARGE","message":"This file is larger than 10 MB.","requestId":"…"}}` and `422 {"error":{"code":"SCANNED_PDF",…}}`.

Route config: `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'`, `export const maxDuration = 26`.

## 5. Text extraction — `lib/pdf/extract-text.ts`

```ts
import pdfParse from 'pdf-parse/lib/pdf-parse.js'   // NOT 'pdf-parse': its index.js reads a test PDF at import time and crashes in Next.js

export type ExtractedPdf = { markedText: string; pages: string[]; pageCount: number; wordCount: number }

export async function extractText(buffer: Buffer): Promise<ExtractedPdf> {
  const pages: string[] = []
  const result = await pdfParse(buffer, {
    max: 0,                                       // parse all pages; page count enforced after
    pagerender: async (pageData: any) => {
      const content = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
      pages[pageData.pageNumber - 1] = itemsToText(content.items)
      return ''                                   // we build our own text
    },
  })
  const cleaned = pages.map(cleanPageText)
  const markedText = buildMarkedText(cleaned)
  return { markedText, pages: cleaned, pageCount: result.numpages, wordCount: countWords(cleaned.join(' ')) }
}
```

- **`itemsToText(items)`:** walk the items in order. When an item's `transform[5]` (the y position) differs from the previous item's by more than 1, start a new line. Between items on the same line, insert a space unless the previous string ends with whitespace or a hyphen. (This is the same algorithm as pdf-parse's default renderer.)
- **`cleanPageText(s)`:**
  - Normalise `\r\n` to `\n`.
  - Collapse 3+ newlines into 2.
  - Trim trailing spaces per line.
  - Replace NUL and other control characters (except `\n` and `\t`) with a space.
  - Remove any literal `[PAGE <n>]` already in the source, which prevents marker spoofing.
- **`buildMarkedText(pages)`:** `pages.map((p, i) => `[PAGE ${i + 1}]\n${p.trim()}`).join('\n\n')`.
- **`countWords(s)`:** `s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length`.
- pdf-parse throws on password-protected files (`PasswordException`) and corrupt files. Both map to `INVALID_PDF`.
- A failed `pagerender` for a single page is treated as an empty page, which still counts toward page count.

`lib/pdf/pdf-parse.d.ts`:
```ts
declare module 'pdf-parse/lib/pdf-parse.js' {
  const pdfParse: (data: Buffer, options?: { max?: number; pagerender?: (pageData: any) => Promise<string> }) =>
    Promise<{ numpages: number; text: string; info: unknown }>
  export default pdfParse
}
```

## 6. `lib/pdf/page-markers.ts` (shared contract)
```ts
export const PAGE_MARKER_RE = /^\[PAGE (\d+)\]$/m
export function splitPages(markedText: string): { page: number; text: string }[]   // parses markers; tolerant of empty pages
export function normalise(s: string): string   // lowercase, collapse whitespace, curly→straight quotes, en/em dash→'-', strip soft hyphens
export function findSentencePage(markedText: string, sentence: string):
  { page: number; start: number; end: number; exact: boolean } | null
  // 1) exact substring of normalise(sentence) inside normalise(pageText) per page
  // 2) else sliding-window token overlap ≥ 0.9 (window = sentence token count ± 20 %)
  // returns offsets in the *normalised* page text plus page number; null if no page qualifies
```

## 7. Token counting — `lib/llm/tokens.ts`
```ts
import { encode } from 'gpt-tokenizer/model/gpt-4o'    // o200k_base, local, no network
export const countTokens = (text: string) => encode(text).length
```
For `MAX_CONTRACT_TOKENS`, count the **marked** text (what the model receives).

## 8. Frontend

### 8.1 Store — `stores/upload-store.ts`
```ts
type Step = 'select' | 'uploading' | 'ready' | 'processing' | 'error'
interface UploadState {
  contractType: 'nda' | 'msa' | null
  file: File | null
  contract: UploadedContractDTO | null
  customTerms: string[]                      // see custom-terms spec
  step: Step
  error: { code: string; message: string } | null
  setType(t): void; setFile(f): void; setContract(c): void; setStep(s): void; setError(e): void
  addCustomTerm(name): 'added' | 'duplicate' | 'limit'; removeCustomTerm(name): void
  reset(keepType?: boolean): void
}
```
`reset()` runs when `/contracts/new` unmounts.

### 8.2 `useUploadContract()`
`useMutation` that posts `FormData` through `apiFetch` (no JSON content-type header). It uses `XMLHttpRequest` only if upload progress is needed. MVP shows an indeterminate spinner, so plain `fetch` is fine.
- `onSuccess`: `setContract`, `setStep('ready')`, invalidate `['dashboard-stats']`.
- `onError`: `setError` and `setStep('error')`.

### 8.3 `ContractTypeSelect`
- Radix `Select` labelled "Contract type" (required). Options "NDA — Non-Disclosure Agreement" and "MSA — Master Service Agreement".
- Disabled while uploading and after a successful upload. Changing the type means "Change file".

### 8.4 `PdfDropzone`
- `useDropzone({ accept: { 'application/pdf': ['.pdf'] }, maxSize: 10_485_760, multiple: false, disabled: !contractType || step === 'uploading' })`.
- Client rejection codes map to the same copy as the server: `file-too-large` → FILE_TOO_LARGE copy, and `file-invalid-type` → "Only PDF files are supported."
- States:

  | State | Content |
  |---|---|
  | disabled (no type) | Muted, helper "Select a contract type first" |
  | idle | `FileUp` icon, "Drag and drop your PDF here", "or **browse files** · PDF up to 10 MB, 20 pages" |
  | drag-active | Border `border-brand`, bg `brand-50`, "Drop to upload" |
  | uploading | Filename + `Spinner` "Extracting text…" |
  | success | `FileText` icon, filename, "6 pages · 2,310 words", "Change file" (ghost) |
  | error | Border `border-danger`, bg `danger-50`, message (`role="alert"`), "Choose another file" |
- Keyboard: the root is focusable (`tabIndex=0`). Enter or Space opens the file picker.
- Design: `h-60 rounded-lg border-2 border-dashed border-border-strong bg-page` (design-system tokens only).

### 8.5 Page layout — `/contracts/new`
- Title "Review a contract" (`text-h5`) and subtitle "Upload an NDA or MSA to extract its key terms."
- ≥ 1024px: two columns (`grid-cols-[1fr_400px] gap-8`). Left: type select + dropzone. Right: `KeyTermPreviewCard`.
- < 1024px: stacked.
- A banner on viewports < 640px reads "For the best experience use Chrome or Firefox on desktop." (S15).

## 9. Edge cases
| Case | Behaviour |
|---|---|
| 11 MB file | Rejected client-side instantly. If sent anyway, 413 |
| 21-page PDF | 422 `TOO_MANY_PAGES` |
| Scanned PDF (image only) | wordCount < 100 → 422 `SCANNED_PDF` |
| > 15k tokens | 422 `TOO_LONG` |
| Password-protected / corrupt / renamed `.docx` | 422 `INVALID_PDF` |
| Empty (0-byte) file | 422 `INVALID_PDF` |
| PDF contains the literal text `[PAGE 3]` | Stripped during cleaning, so markers can't be spoofed |
| Non-ASCII filename (`合同.pdf`) | Slug empty → `contract.pdf`. Original kept in `original_filename` |
| Storage down / bucket missing | 201 with `storageAvailable:false`. The results page uses the text viewer |
| Network drop mid-upload | Client shows "Upload failed. Check your connection and try again." Nothing persisted unless step 11 completed; an orphan `uploaded` row is visible on the dashboard with a "Process" action |
| Same file uploaded twice | Allowed. Two separate contracts |
| User navigates away after upload, before processing | The contract stays `uploaded`. The dashboard row opens the results page in its "ready to process" state |

## 10. Acceptance criteria
- **AC-UP-01:** A 6-page text NDA uploads in ≤ 5 s. The row has `status='uploaded'`, `page_count=6` and `contract_text` starting with `[PAGE 1]\n`, with 6 markers in order.
- **AC-UP-02:** `contract_text` contains exactly `page_count` markers, and `splitPages(contract_text).length === page_count`.
- **AC-UP-03:** Files > 10 MB, > 20 pages, < 100 words, > 15,000 tokens, encrypted, or non-PDF are rejected with the exact messages in foundation §7.1, and **no** `contracts` row or storage object is created.
- **AC-UP-04:** On success, the PDF exists at `contracts/{user_id}/{contract_id}/{slug}.pdf` in Storage and `file_path` matches.
- **AC-UP-05:** If the storage upload fails (simulated by removing the bucket policy), the request still returns 201 with `storageAvailable:false` and `file_path IS NULL`.
- **AC-UP-06:** The dropzone is disabled until a contract type is selected. With a type selected, keyboard users can open the file picker.
- **AC-UP-07:** The 21st upload within an hour returns 429 with `Retry-After`.
- **AC-UP-08:** Importing the upload route does not crash at module load (the pdf-parse import path is correct).

## 11. Tests
- Unit:
  - `extractText` on fixtures: `nda-6p.pdf`, `msa-12p.pdf`, `scanned-2p.pdf`, `encrypted.pdf`, `21-pages.pdf`
  - `buildMarkedText` / `splitPages` round-trip
  - `cleanPageText` marker stripping
  - `countWords`
  - `slugify`
- Integration: the route with a real Supabase test project covering each AC-UP-03 case, the storage failure path (mock the storage client) and the rate limit.
- E2E: `contract-review.spec.ts` (upload step), `errors.spec.ts` (scanned and oversize).
