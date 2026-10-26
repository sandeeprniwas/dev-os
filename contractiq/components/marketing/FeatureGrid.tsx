import { BookOpen, FileSearch, Gauge, MessageSquare, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FileSearch, title: 'Key terms, extracted', body: 'Parties, term, liability caps, IP and more for NDAs and MSAs.' },
  { icon: BookOpen, title: 'Page-level references', body: 'Every term links to the page it was found on.' },
  { icon: Gauge, title: 'Confidence you can see', body: 'Low-confidence results are flagged so you know what to double-check.' },
  { icon: MessageSquare, title: 'Chat with your contract', body: 'Answers come only from your document, with page citations.' },
]

export function FeatureGrid() {
  return (
    <section aria-labelledby="features-heading" className="flex flex-col gap-6">
      <h2 id="features-heading" className="text-h5 text-fg">
        Built for people who sign contracts, not write them
      </h2>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <Card as="li" key={title} className="flex flex-col gap-3">
            <Icon className="h-6 w-6 text-brand" aria-hidden="true" />
            <h3 className="text-body-lg text-fg">{title}</h3>
            <p className="text-body text-fg-muted">{body}</p>
          </Card>
        ))}
      </ul>
    </section>
  )
}
