'use client'

import type { User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Current Supabase user on the client; clears cached server state on sign-out. */
export function useUser(): { user: User | null; isLoading: boolean } {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      setUser(data.user)
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [queryClient])

  return { user, isLoading }
}
