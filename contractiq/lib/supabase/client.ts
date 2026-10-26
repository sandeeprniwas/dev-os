import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/public-env'
import type { Database } from '@/types/database.types'

let browserClient: SupabaseClient<Database> | null = null

/** Browser Supabase client (singleton). RLS applies with the signed-in user's session. */
export function createClient(): SupabaseClient<Database> {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey)
  }
  return browserClient
}
