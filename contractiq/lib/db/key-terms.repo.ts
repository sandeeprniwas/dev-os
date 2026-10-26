import { fromPostgrestError } from '@/lib/api/errors'
import type { Database } from '@/types/database.types'
import type { CustomKeyTermRow, KeyTermRow } from '@/types/domain'
import type { DbClient } from './types'

type KeyTermInsert = Database['public']['Tables']['key_terms']['Insert']

export async function listKeyTerms(db: DbClient, contractId: string): Promise<KeyTermRow[]> {
  const { data, error } = await db
    .from('key_terms')
    .select('*')
    .eq('contract_id', contractId)
    .order('is_custom', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw fromPostgrestError(error)
  return data ?? []
}

/**
 * Replaces all extracted terms for a contract (idempotent on retry after a partial failure).
 * Service-role client only — clients have no INSERT/DELETE on key_terms.
 */
export async function replaceKeyTerms(
  db: DbClient,
  contractId: string,
  userId: string,
  rows: KeyTermInsert[],
): Promise<number> {
  if (rows.some((row) => row.user_id !== userId || row.contract_id !== contractId)) {
    throw new Error('replaceKeyTerms: rows must belong to the verified user and contract')
  }
  const { error: deleteError } = await db.from('key_terms').delete().eq('contract_id', contractId).eq('user_id', userId)
  if (deleteError) throw fromPostgrestError(deleteError)
  if (rows.length === 0) return 0
  const { error } = await db.from('key_terms').insert(rows)
  if (error) throw fromPostgrestError(error)
  return rows.length
}

export async function editKeyTerm(db: DbClient, id: string, value: string): Promise<KeyTermRow> {
  const { data, error } = await db.rpc('edit_key_term', { p_id: id, p_value: value }).single()
  if (error) throw fromPostgrestError(error)
  return data as KeyTermRow
}

export async function listCustomTerms(db: DbClient, contractId: string): Promise<CustomKeyTermRow[]> {
  const { data, error } = await db
    .from('custom_key_terms')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })
  if (error) throw fromPostgrestError(error)
  return data ?? []
}

export async function replaceCustomTerms(db: DbClient, contractId: string, terms: string[]): Promise<CustomKeyTermRow[]> {
  const { data, error } = await db.rpc('replace_custom_terms', { p_contract_id: contractId, p_terms: terms })
  if (error) throw fromPostgrestError(error)
  return (data as CustomKeyTermRow[] | null) ?? []
}
