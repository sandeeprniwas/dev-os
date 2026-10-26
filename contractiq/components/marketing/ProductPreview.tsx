import { AlertTriangle, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

const SAMPLE_TERMS = [
  { name: 'Term & Duration', value: '2 years; confidentiality survives 3 years', page: 3, score: 92, tone: 'success' as const, level: 'High' },
  { name: 'Governing Law', value: 'State of New York', page: 6, score: 88, tone: 'success' as const, level: 'High' },
  { name: 'Non-Solicitation', value: '12 months after termination', page: 4, score: 64, tone: 'warning' as const, level: 'Medium' },
  { name: 'Breach & Remedy', value: 'Injunctive relief available', page: 5, score: 41, tone: 'danger' as const, level: 'Low' },
]

/** Static, illustrative rendering of the key-terms panel using the real design-system components. */
export function ProductPreview() {
  return (
    <figure className="rounded-lg border border-border bg-page p-4" aria-label="Example of ContractIQ key-term results">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-body font-medium text-fg">
          <FileText className="h-4 w-4 text-fg-muted" aria-hidden="true" />
          Acme Mutual NDA
        </span>
        <Badge tone="info">NDA</Badge>
      </div>
      <ul className="flex flex-col gap-2">
        {SAMPLE_TERMS.map((term) => (
          <li key={term.name} className="rounded-lg border border-border bg-surface p-3">
            <p className="text-body font-medium text-fg">{term.name}</p>
            <p className="text-body text-fg">{term.value}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-body-sm text-fg-muted">p. {term.page}</span>
              <Badge tone={term.tone} icon={term.tone === 'danger' ? <AlertTriangle /> : undefined}>
                {term.level} · {term.score}%
              </Badge>
            </div>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">
        Each term shows its value, the page it was found on, and a colour-coded confidence score.
      </figcaption>
    </figure>
  )
}
