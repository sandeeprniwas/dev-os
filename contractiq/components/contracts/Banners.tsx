'use client'

import { AlertTriangle, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import type { ContractType, DetectedContractType } from '@/types/domain'

/** Always visible on results pages; not dismissible (PRD §9, §11). */
export function LegalDisclaimerBanner() {
  return (
    <p role="note" className="flex items-start gap-2 rounded-md border border-border bg-subtle px-4 py-2 text-body-sm text-fg-muted">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      This is an AI-assisted review tool, not legal advice. Always verify critical terms with a qualified lawyer.
    </p>
  )
}

const ARTICLE: Record<DetectedContractType, string> = { nda: 'an NDA', msa: 'an MSA', other: 'a different kind of document' }

export function TypeMismatchBanner({
  contractId,
  selected,
  detected,
}: {
  contractId: string
  selected: ContractType
  detected: DetectedContractType | null
}) {
  const storageKey = `ciq.typeMismatchDismissed.${contractId}`
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(storageKey) === '1')
    } catch {
      setDismissed(false)
    }
  }, [storageKey])

  if (!detected || detected === selected || dismissed) return null

  return (
    <div role="note" className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-4 py-2 text-body text-warning-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        This looks like {ARTICLE[detected]} rather than {ARTICLE[selected]}. Some terms may be missing or less accurate.
      </p>
      <IconButton
        label="Dismiss"
        icon={<X />}
        onClick={() => {
          setDismissed(true)
          try {
            window.sessionStorage.setItem(storageKey, '1')
          } catch {
            // storage unavailable — dismissal lasts for this page view only
          }
        }}
      />
    </div>
  )
}

export function CalibrationBanner() {
  return (
    <p role="note" className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-4 py-2 text-body text-warning-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      Confidence scores are being recalibrated — verify all terms.
    </p>
  )
}
