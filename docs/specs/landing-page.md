# Spec — Landing Page (S2)

**Source:** PRD Flow 1, engineering-doc §2.1, §5.4 · **Release:** v0.1 · **Replaces:** the scaffold's placeholder `app/page.tsx`

## 1. Goal
A static marketing page that explains ContractIQ in one screen and sends visitors to sign up or sign in. No dynamic data apart from swapping the CTA for signed-in visitors.

## 2. Files
| File | Type | Purpose |
|---|---|---|
| `app/(marketing)/page.tsx` | Server Component | Page composition. Replaces the scaffold's `app/page.tsx`, which must be **deleted** because both would map to `/` |
| `app/(marketing)/layout.tsx` | Server Component | `MarketingHeader` + `children` + `MarketingFooter` |
| `components/layout/MarketingHeader.tsx` | Server | Logo + CTAs |
| `components/layout/MarketingFooter.tsx` | Server | Attribution + disclaimer |
| `components/marketing/Hero.tsx` | Server | H1, subcopy, CTAs, demo media |
| `components/marketing/FeatureGrid.tsx` | Server | 4 feature cards |
| `public/demo.gif` | asset | Product demo, ≤ 3 MB, 1200×750 |
| `public/logo.svg` | asset | Wordmark |

## 3. Behaviour
- The page reads the session server-side with `createClient()` from `lib/supabase/server` and `auth.getUser()`:

  | Visitor | Header CTAs | Hero primary CTA |
  |---|---|---|
  | Signed in | "Go to dashboard" → `/dashboard` | "Go to dashboard" |
  | Signed out | "Sign in" (ghost) → `/login`, "Get started free" (primary) → `/signup` | "Get started free" |

- No client JavaScript is required. Hover states are CSS classes only, and there are **no event handlers in Server Components** (frontend-setup rule).
- Metadata: `title: 'ContractIQ — Understand NDAs and MSAs in minutes'`, plus a description and an `openGraph` title/description.

## 4. Content (final copy)
- **H1** (`text-h2 md:text-h1`): "Understand any NDA or MSA in minutes, not hours"
- **Subcopy** (`text-body-lg text-fg-muted`, max-w 640px): "Upload a contract and ContractIQ pulls out the terms that matter — each with the page it came from, a confidence score, and the exact sentence it's based on. Then ask follow-up questions in plain English."
- **Demo:** `<img src="/demo.gif" alt="ContractIQ extracting key terms from an NDA and showing page references" width=1200 height=750>` inside a `rounded-lg border` frame with a fixed aspect ratio (no layout shift).
- **FeatureGrid** (4 `Card`s: icon, title in `text-body-lg`, one line in `text-body text-fg-muted`):
  1. `FileSearch` "Key terms, extracted": "Parties, term, liability caps, IP and more for NDAs and MSAs."
  2. `BookOpen` "Page-level references": "Every term links to the page it was found on."
  3. `Gauge` "Confidence you can see": "Low-confidence results are flagged so you know what to double-check."
  4. `MessageSquare` "Chat with your contract": "Answers come only from your document, with page citations."
- **Footer** (`text-body-sm text-fg-muted`): "Powered by OpenAI GPT-4o · ContractIQ is an AI-assisted review tool, not legal advice. · © {year} ContractIQ"

## 5. Layout & design
- Header: `h-16 px-6 md:px-28 flex items-center justify-between border-b border-border bg-surface`.
- Hero: two columns ≥ 1024px (text left, demo right), stacked below. Vertical padding `py-12 md:py-24`.
- FeatureGrid: `grid gap-6 sm:grid-cols-2 lg:grid-cols-4`, `mt-16`.
- Background: `bg-page`, cards `bg-surface`. No gradients and no shadows (design system).

## 6. Edge cases
| Case | Behaviour |
|---|---|
| `demo.gif` missing or slow | The alt text shows inside a fixed-ratio frame with no layout shift |
| Supabase unreachable during `getUser()` | Treated as signed out and the page still renders. Errors are caught and logged |
| JavaScript disabled | The page renders fully because it is static HTML + CSS |

## 7. Acceptance criteria
- **AC-LP-01:** Signed out: `/` shows the H1, the subcopy, the demo, 4 feature cards, and both "Sign in" and "Get started free".
- **AC-LP-02:** "Get started free" navigates to `/signup` and "Sign in" navigates to `/login`.
- **AC-LP-03:** Signed in: `/` shows "Go to dashboard" instead of the sign-up and sign-in CTAs.
- **AC-LP-04:** The footer contains "Powered by OpenAI GPT-4o" and the "not legal advice" disclaimer.
- **AC-LP-05:** Lighthouse accessibility ≥ 95 and CLS < 0.1 on `/`.
- **AC-LP-06:** The build has no "Event handlers cannot be passed to Client Component props" errors, and `app/page.tsx` (the scaffold) no longer exists.

## 8. Tests
- E2E `landing.spec.ts`: covers AC-LP-01/02/04, plus an axe scan.
- E2E `auth.spec.ts`: after login, visiting `/` shows "Go to dashboard" (AC-LP-03).
