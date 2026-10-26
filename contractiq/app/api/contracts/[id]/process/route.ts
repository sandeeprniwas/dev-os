import { AppError } from '@/lib/api/errors'
import { enforceRateLimit } from '@/lib/security/rateLimiter'
import { requireAuth } from '@/lib/security/authGuard'
import { ndjsonStream } from '@/lib/api/stream'
import { withApiHandler } from '@/lib/api/with-api-handler'
import { PROCESS_DEADLINE_MS } from '@/lib/constants/limits'
import { claimForProcessing, getContractStatus } from '@/lib/db/contracts.repo'
import { hashUserId } from '@/lib/llm/client'
import { getLlmGateway } from '@/lib/llm/gateway'
import { processContract } from '@/lib/services/extraction.service'
import { requireAdminClient } from '@/lib/supabase/admin'
import { parseIdParam } from '@/lib/validation/params'
import type { ProcessEvent } from '@/types/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 26

export const POST = withApiHandler<{ id: string }>(async (_request, { params }) => {
  const id = parseIdParam(params)
  const { user, supabase } = await requireAuth()

  const contract = await getContractStatus(supabase, id)
  if (!contract) throw new AppError('NOT_FOUND')

  // Idempotent: a completed contract returns immediately without an LLM call or rate-limit charge.
  if (contract.status === 'completed') {
    const [{ count }, { data: detected }] = await Promise.all([
      supabase.from('key_terms').select('id', { count: 'exact', head: true }).eq('contract_id', id),
      supabase.from('contracts').select('detected_type').eq('id', id).single(),
    ])
    return ndjsonStream(async (emit) => {
      emit({
        step: 'done',
        contractId: id,
        termCount: count ?? 0,
        detectedType: detected?.detected_type ?? null,
      } satisfies ProcessEvent)
    })
  }

  await enforceRateLimit('process', { userId: user.id })
  // Ownership was verified above with the user's (RLS) client; the status write is server-authoritative.
  const claimed = await claimForProcessing(requireAdminClient(), id, user.id)
  if (!claimed) throw new AppError('ALREADY_PROCESSING')

  const deadline = Date.now() + PROCESS_DEADLINE_MS
  const llm = getLlmGateway()
  return ndjsonStream((emit) =>
    processContract({ db: supabase, llm, userId: user.id, userHash: hashUserId(user.id), contractId: id, emit, deadline }),
  )
})
