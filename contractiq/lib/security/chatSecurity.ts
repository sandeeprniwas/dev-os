import { AppError, fromPostgrestError } from '@/lib/api/errors'
import type { DbClient } from '@/lib/db/types'
import type { ChatSessionRow, ContractRow } from '@/types/domain'

/**
 * Loads a contract through the user-scoped client (RLS) and additionally asserts
 * contract.user_id === userId. Missing or foreign contracts are reported as 404 (never 403), so
 * contract ids cannot be probed. With `requireCompleted`, only processed contracts are allowed.
 */
export async function verifyContractOwnership(
  db: DbClient,
  contractId: string,
  userId: string,
  options: { requireCompleted?: boolean } = {},
): Promise<ContractRow> {
  const { data, error } = await db.from('contracts').select('*').eq('id', contractId).maybeSingle()
  if (error) throw fromPostgrestError(error)
  if (!data || data.user_id !== userId) throw new AppError('NOT_FOUND')
  if (options.requireCompleted && data.status !== 'completed') {
    throw new AppError('CONFLICT', 'Chat is available once the contract has been processed.')
  }
  return data
}

/** Asserts the chat session belongs to `userId` and to `contractId`; otherwise 404. */
export function verifySessionOwnership(session: ChatSessionRow | null, userId: string, contractId: string): ChatSessionRow {
  if (!session || session.user_id !== userId || session.contract_id !== contractId) throw new AppError('NOT_FOUND')
  return session
}
