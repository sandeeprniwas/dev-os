'use client'

import { Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconButton } from '@/components/ui/IconButton'

const STORAGE_KEY = 'ciq.mobileBannerDismissed'

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Shown below 640px on contract pages (large PDFs can strain mobile browsers). */
export function MobileBrowserBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!readDismissed())
  }, [])

  if (!visible) return null

  return (
    <div role="note" className="mb-4 flex items-start gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-body text-brand-700 sm:hidden">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        For the best experience use Chrome or Firefox on desktop. Large PDFs may be slow on mobile devices.
      </p>
      <IconButton
        label="Dismiss"
        icon={<X />}
        onClick={() => {
          setVisible(false)
          try {
            window.localStorage.setItem(STORAGE_KEY, '1')
          } catch {
            // storage unavailable (private mode) — dismissal lasts for this page view only
          }
        }}
      />
    </div>
  )
}
