import type { DbClient } from '@/lib/db/types'
import { logger } from '@/lib/utils/logger'

export const RETENTION_DAYS = 90
const BUCKET = 'contracts'

export type PurgeResult = { scanned: number; purged: number; failed: number; rejected: number; dryRun: boolean }

const RATE_LIMIT_EVENT_RETENTION_MS = 2 * 24 * 3600 * 1000

/**
 * Deletes PDFs not opened for 90 days via the Storage API (direct SQL deletes on storage.objects are
 * blocked by Supabase) and clears contracts.file_path. Extracted text and results are kept.
 * Requires a service-role client. Stops before `budgetMs` so scheduled runs never time out.
 */
export async function purgeExpiredPdfs(
  admin: DbClient,
  options: { now?: Date; batchSize?: number; dryRun?: boolean; budgetMs?: number } = {},
): Promise<PurgeResult> {
  const { now = new Date(), batchSize = 100, dryRun = false, budgetMs = 25_000 } = options
  const startedAt = Date.now()
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString()
  const result: PurgeResult = { scanned: 0, purged: 0, failed: 0, rejected: 0, dryRun }
  const skipped = new Set<string>()

  while (Date.now() - startedAt < budgetMs) {
    const { data, error } = await admin
      .from('contracts')
      .select('id,user_id,file_path')
      .not('file_path', 'is', null)
      .lt('last_accessed_at', cutoff)
      .order('last_accessed_at', { ascending: true })
      .limit(batchSize + skipped.size)
    if (error) throw new Error(`purge query failed: ${error.message}`)

    const candidates = (data ?? []).filter((row) => row.file_path && !skipped.has(row.id)).slice(0, batchSize)
    if (candidates.length === 0) break
    result.scanned += candidates.length

    // The service role bypasses Storage RLS, so only ever delete objects inside the contract's own folder.
    const batch = candidates.filter((row) => (row.file_path as string).startsWith(`${row.user_id}/${row.id}/`))
    for (const row of candidates.filter((candidate) => !batch.includes(candidate))) {
      logger.error('purge_path_rejected', { contractId: row.id })
      skipped.add(row.id)
      result.rejected++
    }
    if (batch.length === 0) continue

    if (dryRun) {
      batch.forEach((row) => skipped.add(row.id))
      continue
    }

    // remove() succeeds whether each object was deleted now or was already missing: either way it is gone.
    const paths = batch.map((row) => row.file_path as string)
    const { error: removeError } = await admin.storage.from(BUCKET).remove(paths)
    if (removeError) {
      logger.warn('purge_remove_failed', { count: paths.length, errorMessage: removeError.message })
      batch.forEach((row) => skipped.add(row.id))
      result.failed += batch.length
      continue
    }

    const { error: updateError } = await admin
      .from('contracts')
      .update({ file_path: null })
      .in(
        'id',
        batch.map((row) => row.id),
      )
    if (updateError) {
      logger.warn('purge_update_failed', { errorMessage: updateError.message })
      batch.forEach((row) => skipped.add(row.id))
      result.failed += batch.length
      continue
    }
    result.purged += batch.length
  }

  if (!dryRun) {
    const { error: pruneError } = await admin
      .from('rate_limit_events')
      .delete()
      .lt('created_at', new Date(now.getTime() - RATE_LIMIT_EVENT_RETENTION_MS).toISOString())
    if (pruneError) logger.warn('rate_limit_prune_failed', { errorMessage: pruneError.message })
  }

  logger.info('purge_expired_pdfs', { ...result, ms: Date.now() - startedAt })
  return result
}
