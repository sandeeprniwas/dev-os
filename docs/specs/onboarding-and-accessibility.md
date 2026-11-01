# Spec — Onboarding, Accessibility & UX Hardening (S15)

**Source:** PRD §5 usability constraints (non-lawyer, no training, WCAG 2.1 AA, jargon tooltips), roadmap v1.0 (onboarding tooltips, WCAG review, performance), external risk "browser file limits" · engineering-doc §5.6 · **Release:** v1.0

## 1. Goal
A first-time user understands the results page without training. The app meets WCAG 2.1 AA. Mobile users get a fair warning, and performance targets are verified before launch.

## 2. Files
| File | Purpose |
|---|---|
| `components/onboarding/OnboardingTour.tsx` | 3-step popover tour |
| `hooks/use-onboarding.ts` | Reads and writes `profiles.onboarding_completed_at` |
| `components/layout/MobileBrowserBanner.tsx` | Small-screen notice |
| `components/layout/SkipToContent.tsx` | Skip link |
| `lib/utils/a11y.ts` | `useReducedMotion()`, `announce()` helper |

## 3. Onboarding tour
- **Trigger:** the first time a user opens a `completed` results page and `profiles.onboarding_completed_at IS NULL`.
- **Steps** (Radix `Popover`, anchored to `[data-tour="…"]`):

  | # | Anchor | Title | Body |
  |---|---|---|---|
  | 1 | `confidence` (first ConfidenceBadge) | Confidence scores | "Green means high confidence. Red ⚠ means we're unsure — check those terms in the document yourself." |
  | 2 | `page` (first PageReferenceButton) | Jump to the source | "Click a page number to see exactly where a term comes from. Click "Why?" to read the sentence." |
  | 3 | `chat` (Chat tab) | Ask questions | "Ask anything about this contract. Answers come only from this document and cite their pages." |
- **Controls:** Back, Next / Done, Skip; a step indicator ("1 of 3", dots in brand-500). Esc = Skip. Focus is trapped in the popover and returns to the anchor afterwards.
- **Completion:** Done or Skip runs `supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', user.id)`. This is allowed by the column grant.
- If an anchor isn't rendered (e.g. mobile tab hidden), that step is skipped.
- Design: `Popover` tokens (design-system §5), max-w 320px, title `text-body-lg font-medium`.

## 4. Jargon help
- Every standard term name has a glossary tooltip (results-page §6.10).
- Confidence badges have explanatory tooltips.
- The empty-chat suggestions model good questions.
- Copy uses plain English throughout (no "indemnitor", "MSA" spelled out on first use on the upload page).

## 5. Accessibility requirements (WCAG 2.1 AA)
| Area | Requirement |
|---|---|
| Landmarks | `header`, `nav`, `main#main`, `footer`; `SkipToContent` link as the first focusable element |
| Headings | One `h1` per page (visually the page title); logical order |
| Keyboard | Every control reachable and operable; no keyboard traps except modal focus traps; visible focus ring (design-system §4) |
| Forms | Labels on all inputs; errors linked via `aria-describedby` and announced (`role="alert"`); focus the first invalid field |
| Dynamic content | Processing progress and chat use `aria-live="polite"`; toasts are announced (sonner default) |
| Colour | Contrast per design-system §6; status never conveyed by colour alone (text + icon) |
| Images | Meaningful `alt`; decorative icons `aria-hidden` |
| Motion | `prefers-reduced-motion` honoured (design-system §4, viewer §6) |
| Zoom | Usable at 200 % browser zoom and 320px width (reflow) |
| Tables | `th` with `scope`, `aria-sort` on sortable headers |
| Language | `<html lang="en">` |

## 6. Mobile notice
`MobileBrowserBanner` shows on viewports < 640px on `/contracts/*`: "For the best experience use Chrome or Firefox on desktop. Large PDFs may be slow on mobile devices."
- Dismissible. The dismissal is stored in `localStorage` key `ciq.mobileBannerDismissed`, with every access wrapped in try/catch.
- Info tone.

## 7. Performance targets (launch gate)
| Metric | Target | How measured |
|---|---|---|
| Extraction end-to-end | ≤ 30 s P95 (route ≤ 24 s) | `contracts.processing_ms` + client timing on 20 eval contracts |
| Chat answer | ≤ 15 s P95; first token < 5 s | `chat_messages.latency_ms` |
| Inline edit save | ≤ 2 s P95 | E2E timing |
| Landing LCP | < 2.5 s on fast 4G | Lighthouse |
| Results page interactive | < 3 s after navigation (20-page PDF) | Playwright trace |

If the extraction P95 inside the function is > 22 s, apply the escape hatch in engineering-doc §6.6 (Background Function).

## 8. Acceptance criteria
- **AC-OB-01:** A new user's first completed results page shows the 3-step tour once. After Done or Skip, it never shows again, even on another device.
- **AC-OB-02:** The tour is fully keyboard-operable, and Esc skips it.
- **AC-A11Y-01:** `@axe-core/playwright` reports 0 serious/critical violations on `/`, `/login`, `/signup`, `/dashboard`, `/contracts/new` and `/contracts/[id]` (terms and chat tabs).
- **AC-A11Y-02:** A keyboard-only E2E completes upload → process → page jump → edit → chat.
- **AC-A11Y-03:** At 320px width there is no horizontal scrolling on any page except the PDF canvas itself.
- **AC-MOB-01:** Below 640px the mobile banner appears on contract pages and stays dismissed after a reload.
- **AC-PERF-01:** All targets in §7 are met on the beta eval run before public launch.

## 9. Tests
- E2E `a11y.spec.ts` (axe on every page plus the keyboard-only flow), and `onboarding.spec.ts`.
- Lighthouse CI on `/` (optional).
