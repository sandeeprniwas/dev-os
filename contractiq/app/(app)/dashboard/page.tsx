import type { Metadata } from 'next'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { getContractsPage, getDashboardStats } from '@/lib/services/stats.service'
import { createClient } from '@/lib/supabase/server'
import { parseContractsQuery } from '@/lib/validation/contracts-query'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const supabase = createClient()
  const query = parseContractsQuery(searchParams)
  const [stats, contracts] = await Promise.all([getDashboardStats(supabase), getContractsPage(supabase, query)])

  return <DashboardView initialStats={stats} initialContracts={{ query, data: contracts }} />
}
