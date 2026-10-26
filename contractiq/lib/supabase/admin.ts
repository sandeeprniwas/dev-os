import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

let adminClient: SupabaseClient<Database> | null = null

/**
 * Service-role client — the ONLY place SUPABASE_SERVICE_ROLE_KEY is read. Bypasses RLS, so callers must
 * verify ownership with the user-scoped client first and filter every write by the verified user id.
 * Used by API services for server-authoritative writes, usage logging, scheduled jobs and CLI scripts.
 * Returns null when the URL or key is not configured. Throws if ever evaluated in a browser.
 */
export function createAdminClient(): SupabaseClient<Database> | null {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient() must never run in the browser')
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null

  if (!adminClient) {
    adminClient = createSupabaseClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return adminClient
}

/** Same as createAdminClient() but required: throws a server error when the service role is not configured. */
export function requireAdminClient(): SupabaseClient<Database> {
  const client = createAdminClient()
  if (!client) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured; server-authoritative writes are unavailable')
  return client
}
