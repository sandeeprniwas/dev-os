'use client'

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ContractTypeBadge, StatusBadge } from '@/components/contracts/StatusBadges'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { formatDate, formatDateTime } from '@/lib/utils/format'
import type { ContractSort, ContractsQuery } from '@/lib/validation/contracts-query'
import type { ContractsListDTO } from '@/types/api'
import { ContractRowActions } from './ContractRowActions'

type ContractsTableProps = {
  query: ContractsQuery
  data: ContractsListDTO | undefined
  isFetching: boolean
  isError: boolean
  onRetry: () => void
  onQueryChange: (patch: Partial<ContractsQuery>) => void
}

const TYPE_FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'nda', label: 'NDA' },
  { value: 'msa', label: 'MSA' },
] as const

function SortHeader({
  label,
  column,
  query,
  onSort,
  className,
}: {
  label: string
  column: ContractSort
  query: ContractsQuery
  onSort: (column: ContractSort) => void
  className?: string
}) {
  const active = query.sort === column
  const Icon = !active ? ArrowUpDown : query.order === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={active ? (query.order === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-4 py-3 text-left', className)}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 rounded-sm text-body-sm font-medium text-fg-muted hover:text-fg"
      >
        {label}
        <Icon className={cn('h-3 w-3', active ? 'text-fg' : 'text-fg-disabled')} aria-hidden="true" />
      </button>
    </th>
  )
}

export function ContractsTable({ query, data, isFetching, isError, onRetry, onQueryChange }: ContractsTableProps) {
  const router = useRouter()
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  function sortBy(column: ContractSort) {
    // Same column toggles direction; a new column starts newest-first for dates, A→Z otherwise.
    const order =
      query.sort === column ? (query.order === 'asc' ? 'desc' : 'asc') : column === 'created_at' ? 'desc' : 'asc'
    onQueryChange({ sort: column, order, page: 1 })
  }

  return (
    <section aria-labelledby="all-contracts-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="all-contracts-heading" className="text-h5 text-fg">
          All contracts
        </h2>
        <div role="group" aria-label="Filter by contract type" className="inline-flex rounded-md border border-border bg-surface p-0.5">
          {TYPE_FILTERS.map((filter) => {
            const pressed = query.type === filter.value
            return (
              <button
                key={filter.label}
                type="button"
                aria-pressed={pressed}
                onClick={() => onQueryChange({ type: filter.value, page: 1 })}
                className={cn(
                  'h-8 rounded-sm px-3 text-body font-medium transition-colors duration-micro',
                  pressed ? 'bg-brand-50 text-brand-700' : 'text-fg-muted hover:text-fg',
                )}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* relative: keeps the table's sr-only labels inside the scroll container (no page-wide overflow on phones) */}
      <Card padding={0} className="relative overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <caption className="sr-only">Your contracts</caption>
          <thead className="border-b border-border">
            <tr>
              <SortHeader label="Name" column="title" query={query} onSort={sortBy} className="pl-6" />
              <SortHeader label="Type" column="contract_type" query={query} onSort={sortBy} />
              <th scope="col" className="px-4 py-3 text-left text-body-sm font-medium text-fg-muted">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right text-body-sm font-medium text-fg-muted">
                Pages
              </th>
              <SortHeader label="Uploaded" column="created_at" query={query} onSort={sortBy} />
              <th scope="col" className="w-14 px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody aria-busy={isFetching} className={cn('divide-y divide-border', isFetching && data && 'opacity-60')}>
            {!data && !isError &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-6 py-3">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))}
            {isError && !data && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-body text-fg-muted">
                  We couldn&apos;t load your contracts.{' '}
                  <button type="button" onClick={onRetry} className="font-medium text-brand hover:text-brand-700">
                    Try again
                  </button>
                </td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-body text-fg-muted">
                  {query.type ? `No ${query.type.toUpperCase()} contracts yet.` : 'No contracts on this page.'}
                </td>
              </tr>
            )}
            {data?.items.map((contract) => (
              <tr
                key={contract.id}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('a,button,[role="menuitem"]')) return
                  router.push(`/contracts/${contract.id}`)
                }}
                className="h-12 cursor-pointer hover:bg-subtle"
              >
                <td className="max-w-[320px] px-4 py-2 pl-6">
                  <Link
                    href={`/contracts/${contract.id}`}
                    title={contract.title}
                    className="block truncate rounded-sm text-body font-medium text-fg hover:text-brand"
                  >
                    {contract.title}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <ContractTypeBadge type={contract.contractType} />
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={contract.status} />
                </td>
                <td className="px-4 py-2 text-right text-body text-fg">{contract.pageCount}</td>
                <td className="px-4 py-2 text-body text-fg-muted">
                  <time dateTime={contract.createdAt} title={formatDateTime(contract.createdAt)}>
                    {formatDate(contract.createdAt)}
                  </time>
                </td>
                <td className="px-4 py-2 text-right">
                  <ContractRowActions contract={contract} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {data && data.total > data.pageSize && (
        <nav aria-label="Pagination" className="flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={query.page <= 1}
            onClick={() => onQueryChange({ page: query.page - 1 })}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </Button>
          <span className="text-body text-fg-muted" aria-live="polite">
            Page {query.page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={query.page >= totalPages}
            onClick={() => onQueryChange({ page: query.page + 1 })}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      )}
    </section>
  )
}
