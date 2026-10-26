import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

type LogoProps = { href?: string; className?: string }

/** ContractIQ wordmark: a document glyph in brand blue + the product name. */
export function Logo({ href = '/', className }: LogoProps) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2 rounded-md text-fg', className)}>
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-brand" aria-hidden="true" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="3" fill="currentColor" />
        <path d="M8 8h8M8 12h8M8 16h5" className="stroke-fg-inverse" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      <span className="text-body-lg font-semibold">
        Contract<span className="text-brand">IQ</span>
      </span>
    </Link>
  )
}
