import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { AppError } from '@/lib/api/errors'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

export type AuthContext = { user: User; supabase: SupabaseClient<Database> }

/**
 * Verifies the caller's session with Supabase Auth (getUser() validates the JWT server-side; the cookie
 * alone is never trusted) and returns the user plus a user-scoped, RLS-enforced client.
 * Throws AppError('UNAUTHENTICATED') → withApiHandler turns it into a 401 JSON response.
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) throw new AppError('UNAUTHENTICATED')
  return { user, supabase }
}

/** Same verification, but returns null instead of throwing (pages that render differently when signed in). */
export async function getAuthenticatedUser(): Promise<User | null> {
  try {
    return (await requireAuth()).user
  } catch {
    return null
  }
}
