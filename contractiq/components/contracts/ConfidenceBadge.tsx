import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { CONFIDENCE_META, confidenceLevel, LOW_CONFIDENCE_MESSAGE } from '@/lib/utils/confidence'

export function ConfidenceBadge({ score }: { score: number }) {
  const level = confidenceLevel(score)
  const meta = CONFIDENCE_META[level]
  const badge = (
    <Badge
      tone={meta.tone}
      icon={level === 'low' ? <AlertTriangle /> : undefined}
      aria-label={`Confidence ${score} percent, ${meta.label.toLowerCase()}`}
      tabIndex={level === 'low' ? 0 : undefined}
      role={level === 'low' ? 'img' : undefined}
    >
      {meta.label} · {score}%
    </Badge>
  )
  return level === 'low' ? <Tooltip content={LOW_CONFIDENCE_MESSAGE}>{badge}</Tooltip> : badge
}

/** Persistent (non-dismissible) warning shown under low-confidence values (PRD §9, FR-11). */
export function LowConfidenceWarning() {
  return (
    <p className="flex items-start gap-1.5 text-body-sm text-danger-700">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {LOW_CONFIDENCE_MESSAGE}
    </p>
  )
}
