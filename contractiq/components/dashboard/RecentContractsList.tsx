import Link from 'next/link'
import { ContractTypeBadge, StatusBadge } from '@/components/contracts/StatusBadges'
import { Card } from '@/components/ui/Card'
import { formatDateTime, formatRelative } from '@/lib/utils/format'
import type { ContractSummaryDTO } from '@/types/api'

export function RecentContractsList({ contracts }: { contracts: ContractSummaryDTO[] }) {
  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-6">
      <h2 id="recent-heading" className="text-h5 text-fg">
        Recently reviewed
      </h2>
      <Card padding={0}>
        <ul className="divide-y divide-border">
          {contracts.map((contract) => (
            <li key={contract.id}>
              <Link
                href={`/contracts/${contract.id}`}
                className="flex flex-wrap items-center gap-3 px-6 py-3 hover:bg-subtle"
              >
                <span className="min-w-0 flex-1 truncate text-body font-medium text-fg" title={contract.title}>
                  {contract.title}
                </span>
                <ContractTypeBadge type={contract.contractType} />
                <StatusBadge status={contract.status} />
                <time
                  dateTime={contract.createdAt}
                  title={formatDateTime(contract.createdAt)}
                  className="w-28 text-right text-body-sm text-fg-muted"
                >
                  {formatRelative(contract.createdAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
