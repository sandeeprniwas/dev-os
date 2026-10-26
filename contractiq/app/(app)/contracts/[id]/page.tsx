import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContractResultsView } from '@/components/contracts/ContractResultsView'
import { getContractDetail } from '@/lib/services/contract.service'
import { createClient } from '@/lib/supabase/server'
import { idParamSchema } from '@/lib/validation/params'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Contract review' }

export default async function ContractPage({ params }: { params: { id: string } }) {
  const parsed = idParamSchema.safeParse(params)
  if (!parsed.success) notFound()

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const detail = await getContractDetail(supabase, parsed.data.id, user.id)
  if (!detail) notFound()

  return <ContractResultsView key={detail.contract.id} initialData={detail} />
}
