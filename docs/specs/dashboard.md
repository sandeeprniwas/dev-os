# Spec — Dashboard & Contract History (S11)

**Source:** PRD Flow 1 step 4, Flow 2, US-008, FR-10 · engineering-doc §4.3, §9.2–9.3 · **Release:** v0.1 (shell + empty state), v0.4 (history)

## 1. Goal
The signed-in home page:
- totals (all contracts, NDAs, MSAs)
- the last 5 reviewed contracts
- a prominent "Review a contract" CTA
- a sortable, paginated table of every contract, where each row opens its results page and can be deleted

## 2. Files
| File | Purpose |
|---|---|
| `app/(app)/dashboard/page.tsx` | Server: prefetch stats + first page; renders client table |
| `app/(app)/dashboard/loading.tsx` | Skeletons |
| `app/api/contracts/route.ts` | `GET` list |
| `app/api/dashboard/stats/route.ts` | `GET` stats |
| `lib/services/stats.service.ts` | `getDashboardStats()` |
| `lib/db/contracts.repo.ts` | `listContracts()` |
| `lib/validation/contracts-query.ts` | `contractsQuerySchema` |
| `components/dashboard/{DashboardStatsCard,RecentContractsList,ContractsTable,ContractRowActions,DashboardEmptyState,StatusBadge,ContractTypeBadge}.tsx` | UI |
| `components/dashboard/ReviewContractButton.tsx` | CTA → `/contracts/new` |
| `hooks/use-contracts.ts`, `hooks/use-dashboard-stats.ts` | Queries |

## 3. API

### 3.1 `GET /api/contracts`
```ts
contractsQuerySchema = z.object({
  sort: z.enum(['created_at', 'title', 'contract_type']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(['nda', 'msa']).optional(),
})
```
- **Query:**
  ```
  select('id,title,contract_type,status,page_count,created_at,processed_at', { count: 'exact' })
  .order(sort, { ascending: order === 'asc' }).order('created_at', { ascending: false })
  .range((page-1)*pageSize, page*pageSize-1)
  ```
  plus `.eq('contract_type', type)` when filtered. For `sort=title`, order by `title` (the `lower(title)` index supports it). Case-insensitive ordering comes from collation, which is acceptable for MVP.
- **Response 200:** `{ "items": [{ "id","title","contractType","status","pageCount","createdAt","processedAt" }], "page": 1, "pageSize": 20, "total": 37 }`. A page beyond the end returns `items: []` with the true `total`.
- **Errors:** 400, 401.

### 3.2 `GET /api/dashboard/stats`
- `rpc('get_dashboard_stats')` plus the 5 most recent contracts (same select, `limit 5`).
- **Response 200:** `{ "total": 14, "byType": { "nda": 9, "msa": 5 }, "recent": [ …5 items… ] }`.

## 4. Page
```
Dashboard (text-h5)                                            [Review a contract]
┌ DashboardStatsCard ────────────────────────────────────────────────────────────┐
│  14 Contracts reviewed   │   9 NDAs   │   5 MSAs                              │
└────────────────────────────────────────────────────────────────────────────────┘
Recently reviewed (text-h5)
  RecentContractsList (≤ 5 rows: title · type badge · status badge · "2 days ago")
All contracts (text-h5)                                   Type filter: [All|NDA|MSA]
  ContractsTable: Name ▲▼ | Type ▲▼ | Status | Pages | Uploaded ▲▼ | ⋯
  Pagination: ‹ Prev   Page 1 of 2   Next ›
```
- **Empty state** (`total === 0`): replaces everything below the header with `DashboardEmptyState`, which shows a `FileText` icon, the copy **"No contracts reviewed yet — upload your first contract to begin"** (PRD wording), and the primary "Review a contract" button.
- Sort, order, page and type live in the URL (`?sort=title&order=asc&page=2&type=nda`) through `useSearchParams` and `router.replace(…, { scroll: false })`. The view survives reloads and can be shared.
- The server component prefetches stats and page 1 for the current params into TanStack Query (`HydrationBoundary`).

## 5. Components
| Component | Spec |
|---|---|
| `DashboardStatsCard` | `Card p-6`, 3 columns separated by `border-l border-border`. Each is a design-system Data Label Pair: value `text-h3 text-fg`, label `text-body-sm text-fg-muted` |
| `RecentContractsList` | `ul` of links `py-3 border-b border-border`: title (`text-body font-medium`), `ContractTypeBadge`, `StatusBadge`, relative date (`Intl.RelativeTimeFormat`) |
| `ContractsTable` | Semantic `<table>`. Sortable headers are `<button>` inside `<th aria-sort="ascending|descending|none">`. Rows `h-12 hover:bg-subtle cursor-pointer`; the Name cell is the primary link (`<Link href=/contracts/{id}>`), the row is clickable, and Enter on the focused link opens it. Pages column right-aligned. Uploaded shows `dd MMM yyyy` with a full timestamp in `title`. Shows 5 skeleton rows while fetching |
| `ContractRowActions` | DropdownMenu (`IconButton` "More actions for {title}"): "Open", "Process" (only when `uploaded`/`error`, links to the results page retry state), "Delete" (opens `DeleteContractDialog`) |
| `StatusBadge` | uploaded → neutral "Ready to process"; processing → info "Processing"; completed → success "Reviewed"; error → danger "Failed" |
| `ContractTypeBadge` | NDA → info; MSA → accent |
| Type filter | Segmented control All / NDA / MSA (`aria-pressed`). Resets the page to 1 |

## 6. Edge cases
| Case | Behaviour |
|---|---|
| 0 contracts | Empty state only |
| Contracts exist but the filter has none | Table empty row: "No {NDA} contracts yet." |
| Page out of range (manual URL) | Empty items → UI resets to page 1 |
| Row deleted in another tab | Opening it gives the 404 page. List refetches on window focus |
| Long titles | `truncate` with a `title` attribute |
| Many contracts (1,000+) | Indexed queries + pagination; no full-table load |

## 7. Acceptance criteria
- **AC-DB-UI-01:** A new user sees "No contracts reviewed yet — upload your first contract to begin" and a "Review a contract" button right after first sign-in (PRD Flow 1).
- **AC-DB-UI-02:** The stats card shows the correct total and NDA/MSA split (FR-10).
- **AC-DB-UI-03:** "Recently reviewed" shows the 5 most recent contracts with status and date (Flow 2).
- **AC-DB-UI-04:** The table shows name, type, status and upload date, and sorts by name, type and date in both directions (US-008, FR-10).
- **AC-DB-UI-05:** Clicking a row opens `/contracts/{id}` (US-008).
- **AC-DB-UI-06:** Sort, filter and page persist in the URL across reloads.
- **AC-DB-UI-07:** A user only ever sees their own contracts (RLS; covered by the cross-user test).
- **AC-DB-UI-08:** The table is keyboard-navigable with correct `aria-sort`.

## 8. Tests
- Unit: `contractsQuerySchema`, `StatusBadge` mapping, sort-header aria.
- Integration: list sorting and pagination math, type filter, stats counts, user isolation.
- E2E: `dashboard.spec.ts` (empty state, sort, open, delete).
