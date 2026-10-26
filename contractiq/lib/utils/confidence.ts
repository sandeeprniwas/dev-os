import { HIGH_CONFIDENCE, LOW_CONFIDENCE } from '@/lib/constants/limits'
import type { BadgeTone } from '@/components/ui/Badge'
import type { ConfidenceLevel } from '@/types/domain'

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= HIGH_CONFIDENCE) return 'high'
  if (score >= LOW_CONFIDENCE) return 'medium'
  return 'low'
}

export const CONFIDENCE_META: Record<ConfidenceLevel, { label: string; tone: BadgeTone }> = {
  high: { label: 'High', tone: 'success' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'danger' },
}

export const LOW_CONFIDENCE_MESSAGE = 'Low confidence — we recommend verifying this in the document directly.'
