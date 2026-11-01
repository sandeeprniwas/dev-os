# Spec — Results Page & Key-Terms Panel (S7)

**Source:** PRD Flow 3 steps 5, 8, 9 · US-003, US-004 · FR-04, FR-07, FR-11 · PRD §9 guardrails · engineering-doc §4.7, §5.4–5.6, §9.4, §9.12 · **Release:** v0.2 (panel), v0.3 ("Why?", glossary)

## 1. Goal
Show the extracted terms next to the contract so the user can verify each one in a click. Each term displays its name, value, page, colour-coded confidence, ⚠️ when confidence is low, and an expandable verbatim source sentence. The "not legal advice" disclaimer is always visible.

## 2. Files
| File | Purpose |
|---|---|
| `app/(app)/contracts/[id]/page.tsx` | Server: load detail, choose the state |
| `app/(app)/contracts/[id]/{loading,error,not-found}.tsx` | Route states |
| `app/api/contracts/[id]/route.ts` | `GET` detail (and `DELETE`, see the retention spec) |
| `app/api/contracts/[id]/complete/route.ts` | `POST` mark review complete |
| `lib/services/contract.service.ts` | `getContractDetail()`, `markReviewComplete()` |
| `components/contracts/ResultsLayout.tsx` | Two-panel / tabbed layout |
| `components/contracts/ResultsHeader.tsx` | Title, badges, actions |
| `components/layout/LegalDisclaimerBanner.tsx` | Disclaimer |
| `components/contracts/TypeMismatchBanner.tsx` | Detected-type warning |
| `components/contracts/CalibrationBanner.tsx` | Shown when `NEXT_PUBLIC_CALIBRATION_WARNING=true` |
| `components/contracts/KeyTermsPanel.tsx` | Summary + sort + list |
| `components/contracts/KeyTermCard.tsx` | One term |
| `components/contracts/ConfidenceBadge.tsx`, `LowConfidenceWarning.tsx` | Confidence UI |
| `components/contracts/PageReferenceButton.tsx` | Jump to page |
| `components/contracts/SourceSentenceDisclosure.tsx` | "Why?" |
| `components/contracts/TermGlossaryTooltip.tsx` | Plain-English definitions |
| `lib/constants/term-glossary.ts` | Definitions (reuses `STANDARD_TERMS[].definition`) |
| `lib/utils/confidence.ts` | `confidenceLevel(score)` → `'high'\|'medium'\|'low'` |
| `stores/review-store.ts` | Shared viewer/panel state |
| `hooks/use-contract.ts` | Query for detail |

## 3. API

### 3.1 `GET /api/contracts/[id]`
- **Auth:** required.
- **Logic:**
  1. Validate `id`.
  2. Select the contract (RLS) → 404 if missing.
  3. Select `key_terms` ordered by `is_custom, sort_order`.
  4. Select `custom_key_terms` and `user_feedback` (maybe null).
  5. **Stale processing:** if `status='processing'` and `updated_at < now()-120s`, return `status: 'error'`, `errorCode: 'TIMEOUT'` in the DTO without writing to the DB.
  6. If `file_path` is set: `storage.createSignedUrl(file_path, 3600)`. On error, `signedUrl = null` and log a warning.
  7. Fire-and-forget `update contracts set last_accessed_at = now()`, at most once per 10 minutes (skip if `last_accessed_at > now()-10min`) to limit writes.
- **Response 200:**
```json
{
  "contract": {
    "id": "6f1c…", "title": "Acme Mutual NDA", "contractType": "nda", "detectedType": "nda",
    "status": "completed", "pageCount": 6, "contractText": "[PAGE 1]\n…",
    "signedUrl": "https://…/storage/v1/object/sign/contracts/…", "signedUrlExpiresAt": "2026-10-25T11:12:00Z",
    "errorCode": null, "errorMessage": null, "processedAt": "…", "reviewCompletedAt": null, "createdAt": "…"
  },
  "keyTerms": [{
    "id": "…", "termKey": "term_and_duration", "termName": "Term & Duration",
    "value": "2 years; confidentiality survives 3 years after termination",
    "originalValue": null, "pageNumber": 3, "confidenceScore": 91,
    "sourceSentence": "This Agreement shall remain in effect for two (2) years…",
    "sourceVerified": true, "isCustom": false, "isEdited": false, "editedAt": null
  }],
  "customTerms": [{ "id": "…", "termName": "Non-compete radius" }],
  "feedback": null
}
```
- **Errors:** 400, 401, 404.

### 3.2 `POST /api/contracts/[id]/complete`
Runs `update contracts set review_completed_at = coalesce(review_completed_at, now()) where id = $1`. Returns 204. Errors: 401, 404.

## 4. Page states (`page.tsx`, server)
| Contract state | Renders |
|---|---|
| Not found / not owned | `notFound()` → "We couldn't find that contract" + "Back to dashboard" |
| `uploaded` (never processed) | `ResultsHeader` + `KeyTermPreviewCard` (pre-filled custom terms) + `ProcessingProgress` with "Process contract", reusing S5/S6 components |
| `processing` (fresh) | `ProcessingProgress` in polling mode (refetch every 3 s until it changes) |
| `error` | `ProcessingProgress` error state with `errorMessage` + "Try again" (custom terms still editable) |
| `completed` | Full results layout (§5) |

`export const dynamic = 'force-dynamic'`. Data comes from `getContractDetail()` called directly (no HTTP hop) and is passed as `initialData` to `useContract(id)`.

## 5. Layout (completed)
```
┌ ResultsHeader: ← Dashboard | "Acme Mutual NDA" [NDA] [Reviewed] ……… [Mark review complete] [⋯ Delete] ┐
├ LegalDisclaimerBanner (always)                                                                     ┤
├ TypeMismatchBanner (conditional) · CalibrationBanner (conditional)                                 ┤
├──────────────── ContractViewer (60%) ───────────────┬──── RightPanel (40%, min 360px) ─────────────┤
│  PdfViewer | TextViewer  (contract-viewer.md)       │ Tabs: [Key terms (11)] [Chat]                 │
│                                                     │ KeyTermsPanel | ChatPanel                     │
└─────────────────────────────────────────────────────┴────────────────────────────────────────────────┘
FeedbackWidget (feedback.md) at the bottom of the right panel's Key terms tab
```
- **≥ 1024px:** `react-resizable-panels` `PanelGroup direction="horizontal"` with `Panel defaultSize={60} minSize={35}` and `Panel defaultSize={40} minSize={28}`. The resize handle is keyboard-accessible (arrow keys). Height is `calc(100vh - 64px - header)`, and each panel scrolls independently.
- **< 1024px:** `Tabs` "Document / Key terms / Chat", one panel visible at a time.

## 6. Components

### 6.1 `ResultsHeader`
- Back link "← Dashboard".
- Title (`text-h5`, truncated with a tooltip showing the full title).
- `Badge` for type and status.
- "Mark review complete" (secondary): calls `POST /complete`, then becomes a disabled "Review completed ✓".
- Overflow menu: "Download PDF" (if `signedUrl`) and "Delete contract" (opens `DeleteContractDialog`, see the retention spec).

### 6.2 `LegalDisclaimerBanner`
Copy: "This is an AI-assisted review tool, not legal advice. Always verify critical terms with a qualified lawyer."
- `role="note"`, `bg-subtle border border-border rounded-md px-4 py-2 text-body-sm text-fg-muted` with an `Info` icon.
- **Not dismissible.**

### 6.3 `TypeMismatchBanner`
Shown when `detectedType && detectedType !== contractType`. Copy: "This looks like {an NDA | an MSA | a different kind of document} rather than {an NDA | an MSA}. Some terms may be missing or less accurate."
- Warning tone.
- Dismissible for the session (`sessionStorage`, wrapped in try/catch).

### 6.4 `KeyTermsPanel`
- **Summary row:** "11 terms · 7 high · 3 medium · 1 low", each count tinted with its tone and given an accessible label.
- **Sort control** (segmented, `aria-pressed`): "Document order" (default: `is_custom, sort_order`) or "Lowest confidence first".
- **List:** `KeyTermCard` × n with `gap-3`. Standard terms first, then a "Custom terms" sub-heading if any custom terms exist.
- **On mount:** if any term has confidence < 50, call `reviewStore.focusTerm(firstLow.id, firstLow.pageNumber, firstLow.sourceSentence)` once per page view. This is PRD Flow 3 step 8: auto-highlight the nearest page span.

### 6.5 `KeyTermCard`
```
┌───────────────────────────────────────────────────────────┐
│ Term & Duration ⓘ                         [Custom]?       │ ← text-body font-medium; ⓘ = TermGlossaryTooltip (standard only)
│ 2 years; confidentiality survives 3 years after …          │ ← EditableTermValue (inline-editing.md), text-body-lg
│ ⚠ Low confidence — we recommend verifying this in the     │ ← only when < 50 (LowConfidenceWarning, persistent text)
│   document directly.                                      │
│ [p. 3]  [High · 91%]  [Edited]?                  Why? ▾   │ ← PageReferenceButton, ConfidenceBadge, EditedBadge, SourceSentenceDisclosure
│ ┃ "This Agreement shall remain in effect for two (2) …"   │ ← expanded quote
│   From page 3                                             │
└───────────────────────────────────────────────────────────┘
```
- `Card p-4`. When `highlightTermId === term.id`: `border-l-4 border-l-brand`, with the card scrolled into view in the panel.
- A null value renders "Not found in document" (`text-fg-muted italic`).

### 6.6 `ConfidenceBadge`
- `confidenceLevel(score)`: `score >= 80 → 'high'`, `score >= 50 → 'medium'`, otherwise `'low'`.
- Labels: "High · {s}%", "Medium · {s}%", "Low · {s}%". Low adds the `AlertTriangle` icon (⚠).
- Tones are success, warning and danger (design-system §6).
- `aria-label="Confidence {s} percent, {level}"`.

### 6.7 `LowConfidenceWarning`
For low-confidence terms:
- Persistent helper text under the value, `text-body-sm text-danger-700` with an `AlertTriangle` icon: "Low confidence — we recommend verifying this in the document directly."
- A `Tooltip` with the same text on the badge (opens on hover and on focus).

There is no close button, so the warning can't be dismissed (PRD §9). The term is **never hidden**.

### 6.8 `PageReferenceButton`
- Shows "p. {n}" as `Button size=sm variant=ghost` with a `FileText` icon and the aria-label "Go to page {n} in the document".
- No page: "No page" (disabled, muted).
- Click: `reviewStore.focusTerm(term.id, term.pageNumber, term.sourceSentence)`. On < 1024px it also calls `setMobileTab('document')`.

### 6.9 `SourceSentenceDisclosure`
- A "Why?" toggle (`aria-expanded`, `aria-controls`).
- Expanded:

  | Case | Content |
  |---|---|
  | Verified | `blockquote` (`border-l-2 border-border-strong pl-3 text-body text-fg`) with the verbatim sentence in quotes, plus a caption "From page {n}" |
  | Unverified | Adds "We couldn't locate this exact sentence in the document — verify manually." (warning tone) |
  | `sourceSentence` null | "No supporting sentence was found in the document." |

### 6.10 `TermGlossaryTooltip`
An ⓘ `IconButton` (label "What is {term}?") with a Tooltip holding the definition from `STANDARD_TERMS`. Not shown for custom terms.

## 7. State — `stores/review-store.ts`
```ts
interface ReviewState {
  target: { page: number | null; text: string | null; termId: string | null; nonce: number } // nonce forces re-scroll on repeat clicks
  activeTab: 'terms' | 'chat'
  mobileTab: 'document' | 'terms' | 'chat'
  zoom: number                       // 0.5–2.0 step 0.25, default 1
  sortMode: 'document' | 'confidence'
  focusTerm(termId: string | null, page: number | null, text: string | null): void
  goToPage(page: number): void       // used by chat citations (text = null)
  setActiveTab(t): void; setMobileTab(t): void; setZoom(z): void; setSortMode(m): void
  reset(): void                      // on route change
}
```
`useContract(id)` is `useQuery({ queryKey: ['contract', id], queryFn, initialData, staleTime: 5 * 60_000 })`. It refetches when `signedUrlExpiresAt - now < 5 min` (checked by a 60 s interval).

## 8. Edge cases
| Case | Behaviour |
|---|---|
| All terms low | Summary shows a red count. The first low term is auto-focused |
| Very long value (> 4 lines) | `line-clamp-4` + "Show more" |
| No custom terms | No "Custom terms" sub-heading |
| Another user's contract id | 404 page (never 403) |
| Signed URL expiry while open | Auto-refetch. The viewer falls back if the refetch fails |
| `processing` and stale | Shown as error with TIMEOUT + Try again |
| Calibration flag on | `CalibrationBanner`: "Confidence scores are being recalibrated — verify all terms." |

## 9. Acceptance criteria
- **AC-RES-01:** Every term card shows term name, value (or "Not found in document"), page ("p. N" or "No page") and a confidence badge with % (FR-04).
- **AC-RES-02:** Badge tone: 80–100 success, 50–79 warning, 0–49 danger with ⚠. Boundary values 49/50/79/80 render correctly.
- **AC-RES-03:** Terms < 50 % show the persistent warning text and tooltip "Low confidence — we recommend verifying this in the document directly." They cannot be dismissed or hidden (FR-11).
- **AC-RES-04:** Clicking "p. N" scrolls the viewer to page N and highlights the source sentence (US-003, FR-07).
- **AC-RES-05:** "Why?" reveals the verbatim source sentence and its page.
- **AC-RES-06:** The disclaimer is visible on every results page in every state.
- **AC-RES-07:** With at least one low-confidence term, the viewer auto-scrolls to the first low term's page on load.
- **AC-RES-08:** `detectedType ≠ contractType` shows the mismatch banner.
- **AC-RES-09:** "Mark review complete" sets `review_completed_at` once. Repeat clicks don't change it.
- **AC-RES-10:** Requesting another user's contract returns 404 from the API and renders the not-found page.
- **AC-RES-11:** At < 1024px the page shows Document / Key terms / Chat tabs, and tapping a page reference switches to Document.

## 10. Tests
- Unit: `confidenceLevel`, `ConfidenceBadge` (boundaries), `LowConfidenceWarning` (present, no dismiss control), `SourceSentenceDisclosure` (3 states), `reviewStore.focusTerm` nonce.
- Integration: `GET /api/contracts/[id]` (owned, foreign → 404, stale processing → error, storage failure → `signedUrl:null`), `POST /complete` idempotency.
- E2E: `contract-review.spec.ts` covers colours, ⚠, page jump and Why?; `a11y.spec.ts` covers the results page.
