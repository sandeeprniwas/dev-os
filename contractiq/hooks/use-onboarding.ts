'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Whether to show the first-run results tour; completion is stored on the profile (cross-device). */
export function useOnboarding() {
  const [shouldShow, setShouldShow] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true
    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user
      if (!user || !active) return
      const { data } = await supabase.from('profiles').select('onboarding_completed_at').eq('id', user.id).maybeSingle()
      if (!active) return
      setUserId(user.id)
      setShouldShow(Boolean(data) && !data?.onboarding_completed_at)
    })()
    return () => {
      active = false
    }
  }, [])

  const complete = useCallback(async () => {
    setShouldShow(false)
    if (!userId) return
    await createClient()
      .from('profiles')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', userId)
  }, [userId])

  return { shouldShow, complete }
}
