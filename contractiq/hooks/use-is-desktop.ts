'use client'

import { useEffect, useState } from 'react'

const DESKTOP_QUERY = '(min-width: 1024px)'

/** True at ≥ 1024px (two-panel results layout); defaults to desktop during SSR. */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    setDesktop(query.matches)
    const onChange = (event: MediaQueryListEvent) => setDesktop(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return desktop
}
