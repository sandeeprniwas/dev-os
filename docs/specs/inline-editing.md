# Spec — Inline Term Editing (S9)

**Source:** PRD Flow 3 step 6, US-009, PRD §2 MOAT (feedback loop), §9 inline correction · engineering-doc §4.8, §9.8 · **Release:** v0.4

## 1. Goal
Let users correct an extracted value in place. The save must complete in ≤ 2 s. Edited terms show an "Edited" badge, and the AI's original value is kept separately to feed the correction-rate metric and prompt improvement.

## 2. Files
| File | Purpose |
|---|---|
| `app/api/key-terms/[id]/route.ts` | `PATCH` |
| `lib/services/key-term.service.ts` | `updateKeyTermValue()` → `rpc('edit_key_term')` |
| `lib/validation/key-terms.ts` | `editKeyTermSchema` |
| `components/contracts/EditableTermValue.tsx` | Display/edit toggle |
| `components/contracts/EditedBadge.tsx` | Badge + tooltip |
| `hooks/use-update-key-term.ts` | Optimistic mutation |

## 3. API — `PATCH /api/key-terms/[id]`
- **Auth:** required.
- **Body:** `editKeyTermSchema = z.object({ value: z.string().trim().min(1, 'Enter a value').max(1000) })`
- **Logic:** call `supabase.rpc('edit_key_term', { p_id: id, p_value: value })`. The function:
  - copies the current `value` into `original_value` only on the **first** edit
  - sets `is_edited = true` and `edited_at = now()`
  - returns the row unchanged if the value didn't change

  `P0002` → 404.
- **Response 200:** `{ "keyTerm": KeyTermDTO }`
- **Errors:** 400 (with `fields.value`), 401, 404.
- Confidence is **not** changed by edits; it describes the AI's extraction.

## 4. UI

### 4.1 `EditableTermValue`
Props `{ term: KeyTermDTO; contractId: string }`.
- **Display mode:**
  - A `button` (styled as text, `text-left w-full rounded-sm hover:bg-subtle`) with the aria-label "Edit value for {termName}". A pencil icon appears on hover and focus.
  - The value is `text-body-lg text-fg`. A null value shows "Not found in document — click to add".
- **Edit mode** (on click or Enter):
  - `Textarea` with `autoGrow`, `maxRows=8`, `maxLength=1000`, prefilled with the value (or empty).
  - A counter "{n}/1000" appears above 800 characters.
  - Buttons: Save (primary sm, `loading` while pending) and Cancel (ghost sm).
  - Keys: **Enter** saves (Shift+Enter inserts a newline) and **Esc** cancels.
  - Focus moves into the textarea on open and back to the display button on close.
- **Save:** runs `mutate({ id, value })`. Edit mode closes immediately (optimistic).
- **Inline error:** an empty value shows "Enter a value" in `FieldError`, and the field stays open.

### 4.2 `EditedBadge`
- A neutral `Badge` reading "Edited" with a `Tooltip`:
  - `originalValue` set: "AI originally extracted: “{originalValue}”"
  - `originalValue` null (the AI found nothing): "AI originally found no value"
- Focusable (`tabIndex=0`) so keyboard users can open the tooltip.

### 4.3 `useUpdateKeyTerm(contractId)`
```ts
useMutation({
  mutationFn: ({ id, value }) => apiFetch(`/api/key-terms/${id}`, { method: 'PATCH', body: { value } }),
  onMutate: async ({ id, value }) => {
    await qc.cancelQueries({ queryKey: ['contract', contractId] })
    const prev = qc.getQueryData(['contract', contractId])
    qc.setQueryData(['contract', contractId], patchTerm(id, t => ({
      ...t, value, isEdited: true, originalValue: t.isEdited ? t.originalValue : t.value, editedAt: new Date().toISOString(),
    })))
    return { prev }
  },
  onError: (_e, _v, ctx) => { qc.setQueryData(['contract', contractId], ctx?.prev); toast.error("Couldn't save your edit. Try again.") },
  onSettled: () => qc.invalidateQueries({ queryKey: ['contract', contractId] }),
})
```

## 5. Edge cases
| Case | Behaviour |
|---|---|
| Value unchanged | No-op server-side; `is_edited` stays as it was |
| Second edit | `original_value` keeps the **first** AI value |
| Editing a null AI value | `original_value = null`, `is_edited = true`; tooltip "AI originally found no value" |
| Network or server error | Optimistic rollback + toast; the value returns to its previous text |
| Two tabs edit the same term | Last write wins. The other tab refreshes on window focus |
| Script/HTML in the value | Stored as text and rendered escaped |
| Attempt to change `confidence_score` via the API or a direct DB call | Not accepted (schema only has `value`; DB column grant forbids it) |

## 6. Acceptance criteria
- **AC-ED-01:** Editing a value and pressing Enter persists it in ≤ 2 s (P95), and the card shows "Edited" after a reload (US-009).
- **AC-ED-02:** After two edits, `original_value` equals the AI's original value, not the first edit.
- **AC-ED-03:** The Edited badge tooltip shows the original AI value.
- **AC-ED-04:** Esc cancels without a request. An empty value shows "Enter a value" and sends no request.
- **AC-ED-05:** A simulated 500 rolls the UI back and shows the error toast.
- **AC-ED-06:** The edited term appears in `term_corrections` with `original_value` and `corrected_value`.
- **AC-ED-07:** The edit flow is fully keyboard-operable, and focus returns to the value afterwards.

## 7. Tests
- Unit: `EditableTermValue` (enter/esc/empty/long), `patchTerm` helper.
- Integration: PATCH first and second edit (original preserved), unchanged value, foreign id → 404, body validation.
- E2E: `edit-term.spec.ts`.
