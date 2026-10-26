import { Card } from '@/components/ui/Card'
import { formatNumber } from '@/lib/utils/format'
import type { DashboardStatsDTO } from '@/types/api'

export function DashboardStatsCard({ stats }: { stats: DashboardStatsDTO }) {
  const items = [
    { label: 'Contracts reviewed', value: stats.total },
    { label: 'NDAs', value: stats.byType.nda },
    { label: 'MSAs', value: stats.byType.msa },
  ]
  return (
    <Card padding={6}>
      <dl className="grid grid-cols-3 divide-x divide-border">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col-reverse gap-0.5 px-4 first:pl-0 sm:px-6">
            <dt className="text-body-sm text-fg-muted">{item.label}</dt>
            <dd className="text-h3 text-fg">{formatNumber(item.value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
