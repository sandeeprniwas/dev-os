'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/Popover'
import { useOnboarding } from '@/hooks/use-onboarding'
import { cn } from '@/lib/utils/cn'

const STEPS = [
  {
    anchor: 'confidence',
    title: 'Confidence scores',
    body: "Green means high confidence. Red ⚠ means we're unsure — check those terms in the document yourself.",
  },
  {
    anchor: 'page',
    title: 'Jump to the source',
    body: 'Click a page number to see exactly where a term comes from. Click "Why?" to read the sentence.',
  },
  {
    anchor: 'chat',
    title: 'Ask questions',
    body: 'Ask anything about this contract. Answers come only from this document and cite their pages.',
  },
] as const

/** First-run 3-step tour on the results page (onboarding spec §3). Steps without a visible anchor are skipped. */
export function OnboardingTour() {
  const { shouldShow, complete } = useOnboarding()
  const [index, setIndex] = useState(0)
  const [anchors, setAnchors] = useState<(HTMLElement | null)[]>([])

  useEffect(() => {
    if (!shouldShow) return
    const timer = setTimeout(() => {
      setAnchors(
        STEPS.map((step) => {
          const element = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`)
          return element && element.offsetParent !== null ? element : null
        }),
      )
    }, 400)
    return () => clearTimeout(timer)
  }, [shouldShow])

  const visibleSteps = useMemo(() => STEPS.map((step, i) => ({ ...step, element: anchors[i] })).filter((s) => s.element), [anchors])
  if (!shouldShow || visibleSteps.length === 0) return null

  const step = visibleSteps[Math.min(index, visibleSteps.length - 1)]
  const last = index >= visibleSteps.length - 1
  const rect = step.element!.getBoundingClientRect()

  return (
    <Popover open onOpenChange={(open) => !open && complete()}>
      <PopoverAnchor asChild>
        <span
          aria-hidden="true"
          className="pointer-events-none fixed"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      </PopoverAnchor>
      <PopoverContent side="bottom" align="start" className="flex flex-col gap-3" aria-label="Product tour">
        <div className="flex flex-col gap-1">
          <h2 className="text-body-lg text-fg">{step.title}</h2>
          <p className="text-body text-fg-muted">{step.body}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-label={`Step ${index + 1} of ${visibleSteps.length}`} role="img">
            {visibleSteps.map((s, i) => (
              <span key={s.anchor} className={cn('h-1.5 w-1.5 rounded-full', i === index ? 'bg-brand' : 'bg-grey-200')} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={complete}>
              Skip
            </Button>
            {index > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setIndex(index - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? complete() : setIndex(index + 1))}>
              {last ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
