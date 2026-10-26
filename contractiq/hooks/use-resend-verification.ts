'use client'

import { useEffect, useState } from 'react'
import { authErrorMessage } from '@/lib/auth/error-messages'
import { publicEnv } from '@/lib/public-env'
import { createClient } from '@/lib/supabase/client'

const COOLDOWN_SECONDS = 60

/** Resends the sign-up confirmation email with a 60 s cooldown. */
export function useResendVerification(email: string) {
  const [cooldown, setCooldown] = useState(0)
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<{ tone: 'info' | 'danger'; message: string } | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function resend() {
    if (!email || cooldown > 0 || pending) return
    setPending(true)
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${publicEnv.appUrl}/auth/callback` },
    })
    setPending(false)
    if (error) {
      setStatus({ tone: 'danger', message: authErrorMessage(error) })
      return
    }
    setStatus({ tone: 'info', message: `We sent a new confirmation link to ${email}.` })
    setCooldown(COOLDOWN_SECONDS)
  }

  return { resend, cooldown, pending, status }
}
