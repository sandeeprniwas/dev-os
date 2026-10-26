'use client'

import { Upload } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useContracts, useDashboardStats } from '@/hooks/use-dashboard'
import { parseContractsQuery, type ContractsQuery } from '@/lib/validation/contracts-query'
import type { ContractsListDTO, DashboardStatsDTO } from '@/types/api'
import { ContractsTable } from './ContractsTable'
import { DashboardEmptyState } from './DashboardEmptyState'
import { DashboardStatsCard } from './DashboardStatsCard'
import { RecentContractsList } from './RecentContractsList'

type DashboardViewProps = {
  initialStats: DashboardStatsDTO
  initialContracts: { query: ContractsQuery; data: ContractsListDTO }
}

export function DashboardView({ initialStats, initialContracts }: DashboardViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = useMemo(() => parseContractsQuery(searchParams), [searchParams])

  const stats = useDashboardStats(initialStats)
  const contracts = useContracts(query, initialContracts)

  // A page beyond the end (e.g. after deleting the last row) snaps back to page 1.
  useEffect(() => {
    if (contracts.data && contracts.data.items.length === 0 && query.page > 1) updateQuery({ page: 1 })
  })

  function updateQuery(patch: Partial<ContractsQuery>) {
    const next = { ...query, ...patch }
    const params = new URLSearchParams()
    if (next.sort !== 'created_at') params.set('sort', next.sort)
    if (next.order !== 'desc') params.set('order', next.order)
    if (next.page !== 1) params.set('page', String(next.page))
    if (next.type) params.set('type', next.type)
    const search = params.toString()
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
  }

  const statsData = stats.data
  const isEmpty = statsData?.total === 0

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h5 text-fg">Dashboard</h1>
        <Button asChild>
          <Link href="/contracts/new">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Review a contract
          </Link>
        </Button>
      </div>

      {!statsData ? (
        <Skeleton className="h-28 w-full" />
      ) : isEmpty ? (
        <DashboardEmptyState />
      ) : (
        <>
          <DashboardStatsCard stats={statsData} />
          {statsData.recent.length > 0 && <RecentContractsList contracts={statsData.recent} />}
          <ContractsTable
            query={query}
            data={contracts.data}
            isFetching={contracts.isFetching}
            isError={contracts.isError}
            onRetry={() => contracts.refetch()}
            onQueryChange={updateQuery}
          />
        </>
      )}
    </div>
  )
}
