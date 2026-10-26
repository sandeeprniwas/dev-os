import 'server-only'
import { AppError } from '@/lib/api/errors'
import { getContractStatus } from '@/lib/db/contracts.repo'
import { upsertFeedback as upsertFeedbackRow } from '@/lib/db/feedback.repo'
import { toFeedbackDTO } from '@/lib/db/mappers'
import type { DbClient } from '@/lib/db/types'
import { feedbackSchema } from '@/lib/validation/feedback'
import type { FeedbackDTO } from '@/types/api'

export async function upsertFeedback(
  db: DbClient,
  args: { userId: string; contractId: string; body: unknown },
): Promise<FeedbackDTO> {
  const contract = await getContractStatus(db, args.contractId)
  if (!contract) throw new AppError('NOT_FOUND')
  const { rating, comment } = feedbackSchema.parse(args.body)
  return toFeedbackDTO(await upsertFeedbackRow(db, { userId: args.userId, contractId: args.contractId, rating, comment }))
}
