import { fromPostgrestError } from '@/lib/api/errors'
import type { Database } from '@/types/database.types'
import type { ChatMessageRow, ChatSessionRow } from '@/types/domain'
import type { DbClient } from './types'

type ChatMessageInsert = Database['public']['Tables']['chat_messages']['Insert']

export async function getChatSession(db: DbClient, contractId: string): Promise<ChatSessionRow | null> {
  const { data, error } = await db.from('chat_sessions').select('*').eq('contract_id', contractId).maybeSingle()
  if (error) throw fromPostgrestError(error)
  return data
}

export async function getOrCreateChatSession(db: DbClient, contractId: string): Promise<ChatSessionRow> {
  const { data, error } = await db.rpc('get_or_create_chat_session', { p_contract_id: contractId }).single()
  if (error) throw fromPostgrestError(error)
  return data as ChatSessionRow
}

/** Messages in ascending order (oldest first). */
export async function listChatMessages(db: DbClient, sessionId: string, limit: number): Promise<ChatMessageRow[]> {
  const { data, error } = await db
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw fromPostgrestError(error)
  return data ?? []
}

export async function getLatestChatMessage(db: DbClient, sessionId: string): Promise<ChatMessageRow | null> {
  const { data, error } = await db
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw fromPostgrestError(error)
  return data
}

export async function insertChatMessage(db: DbClient, row: ChatMessageInsert): Promise<ChatMessageRow> {
  const { data, error } = await db.from('chat_messages').insert(row).select('*').single()
  if (error) throw fromPostgrestError(error)
  return data
}
