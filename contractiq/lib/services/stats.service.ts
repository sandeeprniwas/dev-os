import 'server-only'
import { fromPostgrestError } from '@/lib/api/errors'
import { listContracts, listRecentContracts } from '@/lib/db/contracts.repo'
import { toContractSummaryDTO } from '@/lib/db/mappers'
import type { DbClient } from '@/lib/db/types'
import type { ContractsQuery } from '@/lib/validation/contracts-query'
import type { ContractsListDTO, DashboardStatsDTO } from '@/types/api'

export async function getDashboardStats(db: DbClient): Promise<DashboardStatsDTO> {
  const [statsResult, recent] = await Promise.all([db.rpc('get_dashboard_stats'), listRecentContracts(db, 5)])
  if (statsResult.error) throw fromPostgrestError(statsResult.error)
  const row = Array.isArray(statsResult.data) ? statsResult.data[0] : statsResult.data
  return {
    total: Number(row?.total ?? 0),
    byType: { nda: Number(row?.nda ?? 0), msa: Number(row?.msa ?? 0) },
    recent: recent.map(toContractSummaryDTO),
  }
}

export async function getContractsPage(db: DbClient, query: ContractsQuery): Promise<ContractsListDTO> {
  const { rows, total } = await listContracts(db, query)
  return { items: rows.map(toContractSummaryDTO), page: query.page, pageSize: query.pageSize, total }
}
