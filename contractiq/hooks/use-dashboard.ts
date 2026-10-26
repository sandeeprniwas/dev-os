'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/utils/api-fetch'
import type { ContractsQuery } from '@/lib/validation/contracts-query'
import type { ContractsListDTO, DashboardStatsDTO } from '@/types/api'

export const dashboardKeys = {
  stats: ['dashboard-stats'] as const,
  contracts: (query: ContractsQuery) => ['contracts', query] as const,
  allContracts: ['contracts'] as const,
}

export function useDashboardStats(initialData?: DashboardStatsDTO) {
  return useQuery({
    queryKey: dashboardKeys.stats,
    queryFn: () => apiFetch<DashboardStatsDTO>('/api/dashboard/stats'),
    initialData,
  })
}

function toSearch(query: ContractsQuery): string {
  const params = new URLSearchParams({
    sort: query.sort,
    order: query.order,
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  if (query.type) params.set('type', query.type)
  return params.toString()
}

export function useContracts(query: ContractsQuery, initial?: { query: ContractsQuery; data: ContractsListDTO }) {
  const matchesInitial = initial && JSON.stringify(initial.query) === JSON.stringify(query)
  return useQuery({
    queryKey: dashboardKeys.contracts(query),
    queryFn: () => apiFetch<ContractsListDTO>(`/api/contracts?${toSearch(query)}`),
    initialData: matchesInitial ? initial.data : undefined,
    placeholderData: keepPreviousData,
  })
}
