# Spec — Pre-processing Preview & Custom Key Terms (S5)

**Source:** PRD Flow 3 steps 2–3, US-005, FR-05 · engineering-doc §4.5, §9.6 · **Release:** v0.3

## 1. Goal
While text is extracting, show the user which standard terms ContractIQ will look for. Let them add up to 5 custom terms (e.g. "Non-compete radius") that are extracted with the same structure: value, page, confidence and source sentence.

## 2. Files
| File | Purpose |
|---|---|
| `components/upload/KeyTermPreviewCard.tsx` | Preview list + add input + process button |
| `components/upload/PreviewTermItem.tsx` | One row |
| `components/upload/AddCustomTermInput.tsx` | Inline add form |
| `components/upload/ProcessContractButton.tsx` | Saves custom terms, then starts processing |
| `lib/constants/standard-terms.ts` | Term catalogue (owned by `key-term-extraction.md` §3) |
| `lib/validation/custom-terms.ts` | `customTermNameSchema`, `customTermsBodySchema(contractType)` |
| `app/api/contracts/[id]/custom-terms/route.ts` | `PUT` |
| `lib/services/custom-terms.service.ts` | `replaceCustomTerms()` |

## 3. User flow
1. Selecting a type renders the preview immediately: header "ContractIQ will look for" plus a count badge ("10 terms"), then the standard term names with a "Standard" badge.
2. After upload succeeds (`step === 'ready'`), "+ Add Key Term" is enabled.
3. Clicking it expands an inline input with placeholder "e.g. Non-compete radius" and **Add** / **Cancel** buttons. Enter adds the term and Esc cancels.
4. An added term appears at the end of the list with a violet "Custom" badge and a remove (×) button. The count badge updates ("11 terms").
5. At 5 custom terms the add button is disabled with the helper text "Up to 5 custom terms".
6. **Process Contract** calls `PUT /api/contracts/[id]/custom-terms` with the full list (it may be empty), then `POST /process` (see `key-term-extraction.md`).

Custom terms can be edited until processing starts. After a failed process (`status='error'`), the results page's retry state shows the same card pre-filled from `customTerms`.

## 4. Validation (shared client + server)
```ts
export const customTermNameSchema = z.string().trim()
  .min(2, 'Use at least 2 characters').max(80, 'Use 80 characters or fewer')
  .regex(/[\p{L}\p{N}]/u, 'Enter a term name')
  .transform(s => s.replace(/\s+/g, ' '))

export const customTermsBodySchema = (type: ContractType) => z.object({
  terms: z.array(customTermNameSchema).max(5, 'Up to 5 custom terms'),
}).superRefine(({ terms }, ctx) => {
  const seen = new Set<string>()
  const standard = new Set(STANDARD_TERMS[type].map(t => t.name.toLowerCase()))
  terms.forEach((t, i) => {
    const k = t.toLowerCase()
    if (seen.has(k)) ctx.addIssue({ code: 'custom', path: ['terms', i], message: 'You already added this term' })
    if (standard.has(k)) ctx.addIssue({ code: 'custom', path: ['terms', i], message: 'This term is already included' })
    seen.add(k)
  })
})
```

## 5. API — `PUT /api/contracts/[id]/custom-terms`
- **Auth:** required. **Params:** `id` uuid (400 otherwise).
- **Body:** `{ "terms": ["Non-compete radius", "Auto-renewal"] }`
- **Logic:**
  1. Load the contract (`select id, contract_type, status`). Missing → 404.
  2. If `status` is not `uploaded` or `error`, return 409 `CONFLICT` "Custom terms can't be changed after processing has started."
  3. Validate with `customTermsBodySchema(contract.contract_type)` → 400 with `fields`.
  4. Call `supabase.rpc('replace_custom_terms', { p_contract_id: id, p_terms: terms })`. Errors map through `fromPostgrestError`.
- **Response 200:** `{ "customTerms": [{ "id": "…", "termName": "Non-compete radius" }] }`
- **Errors:** 400 VALIDATION_ERROR, 401, 404, 409 CONFLICT.

## 6. How custom terms reach the model
`extraction.service` loads `custom_key_terms` for the contract and appends them to the target list after the standard terms:
```ts
{ term_key: `custom_${slugify(name).replace(/-/g, '_').slice(0, 60)}`, term_name: name, definition: null }
```
If two names slug to the same key, add a `_2` suffix. Inside the prompt they are JSON-encoded data in `<target_terms>`, never interpolated into instructions (prompt-injection safe). Results land in `key_terms` with `is_custom = true` and the same columns as standard terms (FR-05).

## 7. Components

**`KeyTermPreviewCard`** props:
```ts
{ contractType: ContractType | null; customTerms: string[]; step: Step;
  onAdd(name: string): 'added' | 'duplicate' | 'limit'; onRemove(name: string): void; onProcess(): void }
```
- Empty (no type): "Select a contract type to see which terms we'll extract."
- Shows the 3-step progress header (① Extracting text, ② Analysing with AI, ③ Compiling results). ① reflects the upload state; ② and ③ are driven by `ProcessingProgress` (extraction spec).
- List: `max-h-[360px] overflow-y-auto`, rows `py-2 border-b border-border last:border-0`.

**`PreviewTermItem`:** `{ name, kind: 'standard' | 'custom', onRemove? }`. Shows the name (`text-body text-fg`) and a `Badge` (neutral "Standard" or accent "Custom"). The × `IconButton` has `label="Remove {name}"`.

**`AddCustomTermInput`:**
- Collapsed: a ghost button "+ Add Key Term", disabled unless `step==='ready'` or the retry state applies, and disabled at 5 terms.
- Expanded: `Input` (maxLength 80, autofocus) + Add/Cancel. Inline `FieldError` for duplicates or invalid input. After adding, the input clears and stays open for the next term.

**`ProcessContractButton`:** primary, full width, "Process contract".
- Disabled unless a contract was uploaded and `step` is `ready` or `error`.
- On click: `step='processing'`, run the PUT; on PUT failure show the error and return `step` to `ready`. On success, call `startProcessing()`.

## 8. Edge cases
| Case | Behaviour |
|---|---|
| Duplicate (case-insensitive) | "You already added this term" (client); 400 (server) |
| Same as a standard term ("governing law") | "This term is already included" |
| Whitespace-only, 1 char, 81 chars | Field error; not added |
| 6th term via direct API call | 400 from zod; the DB trigger is the backstop |
| Contract already processing or completed | 409 CONFLICT |
| Term text with quotes, `<tags>`, or "ignore previous instructions" | Stored as plain text; JSON-encoded in the prompt; rendered with React escaping |
| No custom terms | PUT with `[]` (clears any stale list) |

## 9. Acceptance criteria
- **AC-CT-01:** Selecting NDA lists exactly the 10 PRD NDA terms, and MSA lists exactly the 12 MSA terms, in the PRD order.
- **AC-CT-02:** The user can add up to 5 custom terms, each shown with a "Custom" badge. The add control is disabled at 5.
- **AC-CT-03:** Duplicates and standard-term names are rejected with the specified messages, on both client and server.
- **AC-CT-04:** After processing, every custom term appears in the key-terms panel with value (or "Not found in document"), page, confidence and source sentence, with `is_custom = true` (US-005, FR-05).
- **AC-CT-05:** `custom_key_terms` rows have `is_manual = true` and match the submitted list exactly. Re-submitting replaces the list.
- **AC-CT-06:** `PUT` on a `completed` contract returns 409.

## 10. Tests
- Unit: `customTermsBodySchema` cases; `addCustomTerm` store return values; custom `term_key` slug collisions.
- Integration: PUT happy path, replace semantics, 6 terms → 400, 409 on completed, 404 for another user's contract.
- E2E: in `contract-review.spec.ts`, add "Non-compete radius" and assert it appears in the results.
