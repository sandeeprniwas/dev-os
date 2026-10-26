import { fromPostgrestError } from '@/lib/api/errors'
import { STALE_PROCESSING_MS } from '@/lib/constants/limits'
import type { ContractsQuery } from '@/lib/validation/contracts-query'
import type { Database } from '@/types/database.types'
import type { ContractRow, DetectedContractType } from '@/types/domain'
import { CONTRACT_SUMMARY_COLUMNS, type ContractSummaryRow } from './mappers'
import type { DbClient } from './types'

type ContractInsert = Database['public']['Tables']['contracts']['Insert']

export async function insertContract(db: DbClient, row: ContractInsert): Promise<ContractRow> {
  const { data, error } = await db.from('contracts').insert(row).select('*').single()
  if (error) throw fromPostgrestError(error)
  return data
}

/*
 * Write helpers below are called with the service-role client (server-authoritative writes) after the
 * caller verified ownership; every one is additionally scoped to the verified user id.
 */

export async function setFilePath(db: DbClient, id: string, userId: string, filePath: string): Promise<void> {
  const { error } = await db.from('contracts').update({ file_path: filePath }).eq('id', id).eq('user_id', userId)
  if (error) throw fromPostgrestError(error)
}

export async function getContract(db: DbClient, id: string): Promise<ContractRow | null> {
  const { data, error } = await db.from('contracts').select('*').eq('id', id).maybeSingle()
  if (error) throw fromPostgrestError(error)
  return data
}

export async function getContractStatus(
  db: DbClient,
  id: string,
): Promise<Pick<ContractRow, 'id' | 'status' | 'contract_type' | 'file_path' | 'updated_at'> | null> {
  const { data, error } = await db
    .from('contracts')
    .select('id,status,contract_type,file_path,updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw fromPostgrestError(error)
  return data
}

export async function listContracts(
  db: DbClient,
  query: ContractsQuery,
): Promise<{ rows: ContractSummaryRow[]; total: number }> {
  const from = (query.page - 1) * query.pageSize
  let builder = db
    .from('contracts')
    .select(CONTRACT_SUMMARY_COLUMNS, { count: 'exact' })
    .order(query.sort, { ascending: query.order === 'asc' })
  if (query.sort !== 'created_at') builder = builder.order('created_at', { ascending: false })
  if (query.type) builder = builder.eq('contract_type', query.type)

  const { data, error, count } = await builder.range(from, from + query.pageSize - 1)
  if (error) throw fromPostgrestError(error)
  return { rows: data ?? [], total: count ?? 0 }
}

export async function listRecentContracts(db: DbClient, limit = 5): Promise<ContractSummaryRow[]> {
  const { data, error } = await db
    .from('contracts')
    .select(CONTRACT_SUMMARY_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw fromPostgrestError(error)
  return data ?? []
}

/**
 * Atomically moves a contract into `processing`. Succeeds from `uploaded`/`error`, or from a
 * `processing` row that has been stale for STALE_PROCESSING_MS (crashed function). Returns false otherwise.
 */
export async function claimForProcessing(db: DbClient, id: string, userId: string, now = new Date()): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS).toISOString()
  const { data, error } = await db
    .from('contracts')
    .update({ status: 'processing', error_code: null, error_message: null })
    .eq('id', id)
    .eq('user_id', userId)
    .or(`status.in.(uploaded,error),and(status.eq.processing,updated_at.lt.${staleBefore})`)
    .select('id')
  if (error) throw fromPostgrestError(error)
  return (data?.length ?? 0) > 0
}

export async function completeContract(
  db: DbClient,
  id: string,
  userId: string,
  fields: { detectedType: DetectedContractType; promptVersion: string; model: string; processingMs: number },
): Promise<void> {
  const { error } = await db
    .from('contracts')
    .update({
      status: 'completed',
      detected_type: fields.detectedType,
      prompt_version: fields.promptVersion,
      model: fields.model,
      processing_ms: fields.processingMs,
      processed_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw fromPostgrestError(error)
}

export async function failContract(db: DbClient, id: string, userId: string, code: string, message: string): Promise<void> {
  const { error } = await db
    .from('contracts')
    .update({ status: 'error', error_code: code, error_message: message })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw fromPostgrestError(error)
}

export async function touchLastAccessed(db: DbClient, id: string, userId: string): Promise<void> {
  const { error } = await db
    .from('contracts')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw fromPostgrestError(error)
}

export async function markReviewComplete(db: DbClient, id: string, userId: string, completedAt: string | null): Promise<void> {
  if (completedAt) return
  const { error } = await db
    .from('contracts')
    .update({ review_completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('review_completed_at', null)
  if (error) throw fromPostgrestError(error)
}

export async function deleteContract(db: DbClient, id: string): Promise<boolean> {
  const { data, error } = await db.from('contracts').delete().eq('id', id).select('id')
  if (error) throw fromPostgrestError(error)
  return (data?.length ?? 0) > 0
}
