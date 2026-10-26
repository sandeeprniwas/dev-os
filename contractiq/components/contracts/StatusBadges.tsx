import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { CONTRACT_TYPE_LABELS } from '@/lib/constants/standard-terms'
import type { ContractStatus, ContractType } from '@/types/domain'

const STATUS_META: Record<ContractStatus, { label: string; tone: BadgeTone }> = {
  uploaded: { label: 'Ready to process', tone: 'neutral' },
  processing: { label: 'Processing', tone: 'info' },
  completed: { label: 'Reviewed', tone: 'success' },
  error: { label: 'Failed', tone: 'danger' },
}

export function StatusBadge({ status }: { status: ContractStatus }) {
  const meta = STATUS_META[status]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

export function ContractTypeBadge({ type }: { type: ContractType }) {
  return <Badge tone={type === 'nda' ? 'info' : 'accent'}>{CONTRACT_TYPE_LABELS[type].short}</Badge>
}
