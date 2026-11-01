# Spec — Design System Implementation (UI foundation)

**Source:** `docs/design.md` (allNeurons), engineering-doc §5.2 · **Applies to:** every frontend file · **Skill:** `/design-system` is mandatory when writing UI code

This spec turns `docs/design.md` into a Tailwind theme, global CSS and a set of primitives. Feature specs only reference the token names defined here, never raw hex values.

---

## 1. Rules (from design.md, enforced in review)

1. **Inter Display** is the only typeface. Letter-spacing is 0 throughout.
2. Component code never contains raw hex values. Use semantic Tailwind classes (`text-fg`, `bg-surface`, `border-default`, …) or palette classes (`bg-success-50`).
3. Every spacing, size and gap is a multiple of 4px. Use Tailwind's default spacing scale (1 unit = 4px) and never `[13px]`-style arbitrary values.
4. Depth is flat: **no shadows** and no gradients. Elevation comes from background steps (Grey 25 page → White card) plus a 1px Grey 100 border. The one exception is floating overlays (popover, toast, dropdown), which use a 1px border plus the `shadow-overlay` token.
5. Color is a signal: grey is the default. Blue = brand/info, Green = success, Red = error/danger, Yellow = warning, Violet = accent (Custom badge, MSA tag).
6. Text: Grey 900 primary, Grey 500 secondary. Grey 400 is allowed for disabled/placeholder text only, and Grey 300 never for text (contrast 3.16:1).
7. Section titles use H5 (24/32, 500).

---

## 2. Tokens → Tailwind (`tailwind.config.ts`)

```ts
import type { Config } from 'tailwindcss'

const grey   = { 25:'#FAFAFA', 50:'#F0F0F1', 100:'#DADADB', 200:'#C1C2C3', 300:'#8F9193', 400:'#5E6062', 500:'#4A4C4F', 600:'#2C2F32', 700:'#25272B', 800:'#151719', 900:'#070A0E' }
const blue   = { 50:'#E7EFFC', 100:'#B6CFF5', 200:'#92B7F0', 300:'#6196EA', 400:'#89B7FF', 500:'#115ACB', 600:'#0044AE', 700:'#0D469E', 800:'#0A367B', 900:'#082A5E' }
const green  = { 50:'#E7F6E7', 100:'#B6E2B4', 200:'#92D490', 300:'#61C05E', 400:'#42B43E', 500:'#13A10E', 600:'#11930D', 700:'#0D720A', 800:'#0A5908', 900:'#084406' }
const red    = { 50:'#FAEBEB', 100:'#F1C0C1', 200:'#EAA2A3', 300:'#E0777A', 400:'#DA5D60', 500:'#D13438', 600:'#BE2F33', 700:'#942528', 800:'#731D1F', 900:'#581618' }
const yellow = { 50:'#FFF9F0', 100:'#FFF2E0', 200:'#FFE3BD', 300:'#FFD294', 400:'#FFC16B', 500:'#FFAA33', 600:'#FA9200', 700:'#DB8000', 800:'#B36800', 900:'#854D00' }
const violet = { 50:'#F7F0FF', 100:'#F2E5FF', 200:'#E3C7FF', 300:'#D1A3FF', 400:'#B870FF', 500:'#7F00FF', 600:'#7000E0', 700:'#6600CC', 800:'#5700AD', 900:'#380070' }
const orange = { 50:'#FFF4F0', 100:'#FFE9E0', 200:'#FFD3C2', 300:'#FFBA9E', 400:'#FF956B', 500:'#FF4405', 600:'#E63900', 700:'#D63D00', 800:'#B33300', 900:'#802400' }

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        grey, orange,
        brand:   { ...blue, DEFAULT: blue[500] },
        success: { ...green, DEFAULT: green[500] },
        danger:  { ...red, DEFAULT: red[500] },
        warning: { ...yellow, DEFAULT: yellow[500] },
        accent:  { ...violet, DEFAULT: violet[500] },
        // semantic aliases (use these in components)
        fg:      { DEFAULT: grey[900], muted: grey[500], disabled: grey[400], inverse: '#FFFFFF' },
        page:    grey[25],      // page background
        surface: '#FFFFFF',     // cards, modals, panels
        subtle:  grey[50],      // hover, dividers, chat assistant bubble
        border:  { DEFAULT: grey[100], strong: grey[200], focus: blue[500] },
      },
      fontFamily: { sans: ['var(--font-inter-display)', 'Inter', 'system-ui', 'sans-serif'] },
      fontSize: {
        h1:      ['48px', { lineHeight: '56px', fontWeight: '700' }],
        h2:      ['36px', { lineHeight: '44px', fontWeight: '700' }],
        h3:      ['30px', { lineHeight: '38px', fontWeight: '600' }],
        h4:      ['28px', { lineHeight: '36px', fontWeight: '600' }],
        h5:      ['24px', { lineHeight: '32px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        body:    ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }],
      },
      letterSpacing: { normal: '0' },
      borderRadius: { none: '0', sm: '4px', DEFAULT: '6px', md: '6px', lg: '8px', xl: '12px', full: '9999px' },
      boxShadow: { overlay: '0 4px 16px rgba(7,10,14,0.08)' },
      spacing: { 18: '72px', 28: '112px' },
      transitionDuration: { micro: '100ms', fast: '150ms', base: '200ms', page: '250ms' },
      keyframes: {
        'pulse-outline': { '0%,100%': { outlineColor: 'transparent' }, '50%': { outlineColor: blue[500] } },
      },
      animation: { 'pulse-outline': 'pulse-outline 1s ease-in-out 2' },
    },
  },
  plugins: [],
} satisfies Config
```

`body` (14/20) is an addition the app needs for dense UI such as the table, form labels and term meta. Every other step comes from design.md.

`postcss.config.mjs`: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`

---

## 3. Font

**Decision (Stage 4):** Inter Display isn't on Google Fonts, so the product owner chose **Inter from Google Fonts** as the substitute. `next/font/google` downloads it at build time and self-hosts it, so no request goes to Google at runtime and the CSP's `font-src 'self'` still holds.

```ts
// app/fonts.ts
import { Inter } from 'next/font/google'
export const interDisplay = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter-display', display: 'swap' })
```
`<html className={interDisplay.variable}>` and `<body className="bg-page font-sans text-body text-fg antialiased">`. Swapping to self-hosted Inter Display files later only requires changing `app/fonts.ts` to `next/font/local`.

## 4. `app/globals.css`

This replaces the scaffold's file, which used gradient buttons that violate the design system.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root { color-scheme: light; }
  html { -webkit-text-size-adjust: 100%; }
  body { letter-spacing: 0; }
  :focus-visible { outline: 2px solid theme('colors.brand.500'); outline-offset: 2px; }
  ::selection { background: theme('colors.brand.50'); }
}

@layer components {
  .term-highlight { background: theme('colors.warning.200'); outline: 2px solid theme('colors.warning.500'); border-radius: 2px; transition: background-color 300ms ease-in-out; }
  .term-highlight-faded { background: theme('colors.warning.100'); outline: none; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

---

## 5. Primitives — `components/ui/`

Every primitive accepts `className` (merged with `cn()` = `twMerge(clsx(...))`) and forwards refs.

| Component | API | Styling |
|---|---|---|
| `Button` | `variant: 'primary'\|'secondary'\|'ghost'\|'danger'`, `size: 'sm'\|'md'\|'lg'`, `loading?: boolean`, `asChild?: boolean` | Base: `inline-flex items-center gap-2 rounded-md text-body-lg transition-colors duration-micro disabled:bg-grey-25 disabled:text-fg-disabled disabled:border-border`. **primary**: `bg-brand text-fg-inverse hover:bg-brand-600 active:bg-brand-700`. **secondary**: `bg-surface border border-border text-fg hover:bg-subtle hover:border-border-strong`. **ghost**: `text-fg hover:bg-subtle`. **danger**: `bg-danger text-fg-inverse hover:bg-danger-600`. Sizes: sm `h-8 px-3 text-body`, md `h-10 px-4`, lg `h-12 px-6`. `loading` shows `Spinner`, sets `aria-busy` and disables the button |
| `Input` | native props + `invalid?: boolean` | `h-10 w-full rounded-md border border-border bg-surface px-3 text-body text-fg placeholder:text-fg-disabled focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand-500/20`. Invalid: `border-danger bg-danger-50` |
| `Textarea` | same as Input + `autoGrow?: boolean`, `maxRows?: number` | Same tokens, `py-2` |
| `Label` | `htmlFor`, `required?` | `text-body font-medium text-fg`; required shows `*` in `text-danger` with `aria-hidden` |
| `FieldError` | `id`, children | `text-body-sm text-danger-700`, `role="alert"` |
| `Select` | Radix Select wrapper: `options: {value,label}[]`, `value`, `onValueChange`, `placeholder`, `disabled` | Trigger styled like Input; content `rounded-lg border bg-surface shadow-overlay` |
| `Badge` | `tone: 'neutral'\|'info'\|'success'\|'warning'\|'danger'\|'accent'`, `icon?` | Design-system Status Badge: `inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-body-sm font-medium`. Tone classes in §6 |
| `Tooltip` | `content`, `children`, `open?`, `side?` | Radix; `rounded-md bg-grey-900 px-2 py-1 text-body-sm text-fg-inverse`; delay 300 ms; also opens on focus |
| `Dialog` / `AlertDialog` | Radix wrappers: `title`, `description`, `footer` | Overlay `bg-grey-900/40`; content `rounded-xl border bg-surface p-6 max-w-[480px]`; enter 200 ms ease-out, exit 150 ms ease-in |
| `Popover` | Radix wrapper | `rounded-lg border bg-surface p-4 shadow-overlay max-w-80` |
| `Tabs` | Radix wrapper | List `border-b border-border`; trigger `h-10 px-4 text-body-lg text-fg-muted data-[state=active]:text-fg data-[state=active]:border-b-2 data-[state=active]:border-brand` |
| `Card` | `as?`, `padding?: 4\|6` | `rounded-lg border border-border bg-surface` |
| `Skeleton` | `className` | `animate-pulse rounded-md bg-subtle` |
| `Spinner` | `size: 16\|20\|24`, `label?` | lucide `Loader2` with `animate-spin`; `role="status"` + sr-only label |
| `IconButton` | `label` (required, becomes `aria-label`), `icon`, variant as Button | Square: `h-8 w-8` / `h-10 w-10` |
| `VisuallyHidden` | children | `sr-only` |

---

## 6. Status color mapping (one table, used everywhere)

| Tone | Background | Border | Text | Contrast |
|---|---|---|---|---|
| neutral | `grey-50` | `grey-200` | `grey-700` | 13.1:1 |
| info | `brand-50` | `brand-200` | `brand-700` | 7.6:1 |
| success | `success-50` | `success-200` | `success-700` | 5.5:1 |
| warning | `warning-50` | `warning-200` | **`warning-900`** | 6.6:1 |
| danger | `danger-50` | `danger-200` | `danger-700` | 7.1:1 |
| accent | `accent-50` | `accent-200` | `accent-700` | 7.7:1 |

**Deviation from design.md:** the warning state table lists Yellow 800 text, but Yellow 800 on Yellow 50 is 4.10:1, which fails WCAG AA for 12px text. Use Yellow 900.

**Domain mappings:**

| Domain value | Tone | Label |
|---|---|---|
| Confidence ≥ 80 | success | "High · 92%" |
| Confidence 50–79 | warning | "Medium · 64%" |
| Confidence < 50 | danger + ⚠ icon | "Low · 38%" |
| Status `uploaded` | neutral | "Ready to process" |
| Status `processing` | info | "Processing" |
| Status `completed` | success | "Reviewed" |
| Status `error` | danger | "Failed" |
| Type NDA | info | "NDA" |
| Type MSA | accent | "MSA" |
| Custom term | accent | "Custom" |
| Standard term | neutral | "Standard" |
| Edited | neutral | "Edited" |

---

## 7. Layout primitives — `components/layout/`

- **App shell** (`(app)/layout.tsx`):
  - `min-h-screen bg-page`.
  - `AppHeader`: `h-16 border-b border-border bg-surface px-6`, holding the logo, `nav` and `UserMenu`.
  - Main area: `mx-auto w-full max-w-[1440px] px-6 py-8 lg:px-10`. design.md's page padding of 112/96 is for documentation canvases, and app screens use this denser padding, in line with design.md's "density over sprawl".
- **Marketing pages**: `px-6 md:px-28 py-12 md:py-24`, which is design.md's page padding on desktop.
- **Section block**: `flex flex-col gap-6`, with the title as `<h2 className="text-h5">`.
- **Major groups**: `gap-10` (40px).

---

## 8. Motion

| Interaction | Tailwind |
|---|---|
| Hover / focus | `transition-colors duration-micro ease-out` |
| Tooltip / dropdown | `duration-fast ease-out` |
| Modal enter / exit | `duration-base ease-out` / `duration-fast ease-in` |
| Skeleton → content | 300 ms fade |

All motion is disabled under `prefers-reduced-motion` (§4).

---

## 9. Acceptance criteria
- **AC-DS-01:** `grep -rE "#[0-9A-Fa-f]{3,6}" app components --include=*.tsx` returns no matches. Hex values appear only in `tailwind.config.ts` and `globals.css`.
- **AC-DS-02:** Every rendered text node uses Inter Display (computed `font-family`) on landing, dashboard and results.
- **AC-DS-03:** axe-core reports no color-contrast violations on any page.
- **AC-DS-04:** Every interactive element shows a visible 2px Blue 500 focus ring on keyboard focus.
- **AC-DS-05:** No `box-shadow` is applied except on Popover, Dropdown, Select content and Toast.
- **AC-DS-06:** With `prefers-reduced-motion: reduce` emulated, scrolling to a page reference is instant and no animation runs.
