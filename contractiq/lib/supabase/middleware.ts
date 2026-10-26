import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from '@/lib/public-env'
import type { Database } from '@/types/database.types'

/**
 * Refreshes the Supabase session cookie for this request and returns the verified user.
 * Used by middleware.ts; the returned response must be the one sent to the browser.
 */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // getUser() validates the JWT with Supabase Auth (getSession() would trust the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
