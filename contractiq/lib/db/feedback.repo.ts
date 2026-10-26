import { fromPostgrestError } from '@/lib/api/errors'
import type { FeedbackRating, UserFeedbackRow } from '@/types/domain'
import type { DbClient } from './types'

export async function getFeedback(db: DbClient, contractId: string): Promise<UserFeedbackRow | null> {
  const { data, error } = await db.from('user_feedback').select('*').eq('contract_id', contractId).maybeSingle()
  if (error) throw fromPostgrestError(error)
  return data
}

export async function upsertFeedback(
  db: DbClient,
  row: { userId: string; contractId: string; rating: FeedbackRating; comment: string | null },
): Promise<UserFeedbackRow> {
  const { data, error } = await db
    .from('user_feedback')
    .upsert(
      { user_id: row.userId, contract_id: row.contractId, rating: row.rating, comment: row.comment },
      { onConflict: 'user_id,contract_id' },
    )
    .select('*')
    .single()
  if (error) throw fromPostgrestError(error)
  return data
}
