# Spec — Feedback (S12)

**Source:** US-010, FR-12, PRD §3 NPS / satisfaction metrics · engineering-doc §4.10, §9.11 · **Release:** v1.0

## 1. Goal
One thumbs up/down rating per user per contract, with an optional comment. It feeds the beta satisfaction target (≥ 75 % "accurate") and the improvement loop.

## 2. Files
| File | Purpose |
|---|---|
| `app/api/contracts/[id]/feedback/route.ts` | `POST` upsert |
| `lib/services/feedback.service.ts` | `upsertFeedback()` |
| `lib/validation/feedback.ts` | `feedbackSchema` |
| `components/contracts/FeedbackWidget.tsx` | UI |

## 3. API — `POST /api/contracts/[id]/feedback`
- **Auth:** required.
- **Body:**
  ```ts
  feedbackSchema = z.object({
    rating: z.enum(['up', 'down']),
    comment: z.string().trim().max(1000).optional().transform(v => v || null),
  })
  ```
- **Logic:**
  1. Verify the contract exists (404).
  2. Run `supabase.from('user_feedback').upsert({ user_id, contract_id, rating, comment }, { onConflict: 'user_id,contract_id' }).select().single()`.
- **Response 200:** `{ "feedback": { "id": "…", "rating": "down", "comment": "Missed the liability cap", "updatedAt": "…" } }`
- **Errors:** 400, 401, 404.

## 4. UI — `FeedbackWidget`
Props `{ contractId, initial: { rating, comment } | null }`. It sits at the bottom of the Key terms tab (`Card p-4 mt-6`).
- Title "Were these results accurate?" (`text-body font-medium`).
- Two toggle buttons, `aria-pressed`, `IconButton` size md:
  - `ThumbsUp` with the label "Yes, results were accurate"
  - `ThumbsDown` with the label "No, results were not accurate"

  Selected: `border-brand bg-brand-50 text-brand-700`.
- After a rating is selected, a `Textarea` appears (placeholder "What could be better? (optional)", max 1000, counter after 800) with a "Submit feedback" button.
- Success: the content is replaced by `CheckCircle2` + "Thanks for the feedback" + "Change" (link back to edit mode).
- With `initial` present, the widget starts in the success state, showing the previous choice and "Change".
- Errors: toast "Couldn't save your feedback. Try again." The form keeps its state.

## 5. Edge cases
| Case | Behaviour |
|---|---|
| Submit without a rating | Button disabled |
| Second submission | Upsert updates the same row |
| Comment with HTML | Stored as text, rendered escaped |
| Feedback on a non-completed contract | Widget only renders in the completed state |

## 6. Acceptance criteria
- **AC-FB-01:** Thumbs up/down plus an optional comment is available on the results page and saves to `user_feedback` with `user_id`, `contract_id`, `rating`, `comment` and a timestamp (FR-12).
- **AC-FB-02:** Re-submitting updates the existing row. There is never more than one row per user per contract.
- **AC-FB-03:** Reloading the page shows the saved rating.
- **AC-FB-04:** Comments over 1000 characters are rejected (400 / client counter blocks them).
- **AC-FB-05:** Toggle buttons expose `aria-pressed` and are keyboard-operable.

## 7. Tests
- Unit: `feedbackSchema`.
- Integration: upsert twice → 1 row; foreign contract → 404.
- E2E: part of `contract-review.spec.ts`.
