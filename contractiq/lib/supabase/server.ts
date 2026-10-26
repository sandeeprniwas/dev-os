import 'server-only'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { publicEnv } from '@/lib/public-env'
import type { Database } from '@/types/database.types'

/**
 * Request-scoped Supabase client for Server Components and Route Handlers.
 * Create a new one per request; RLS applies with the caller's session.
 */
export function createClient(): SupabaseClient<Database> {
  const cookieStore = cookies()

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // middleware.ts refreshes the session cookie on every request instead.
        }
      },
    },
  })
}
