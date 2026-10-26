import Link from 'next/link'
import { Logo } from './Logo'
import { UserMenu } from './UserMenu'

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-surface">
      <div className="mx-auto flex h-full w-full max-w-[1440px] items-center justify-between gap-6 px-6 lg:px-10">
        <Logo href="/dashboard" />
        <nav aria-label="Main" className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="hidden rounded-md px-2 py-1 text-body font-medium text-fg-muted hover:text-fg sm:inline-flex"
          >
            Dashboard
          </Link>
          <Link
            href="/contracts/new"
            className="hidden rounded-md px-2 py-1 text-body font-medium text-fg-muted hover:text-fg sm:inline-flex"
          >
            Review a contract
          </Link>
          <UserMenu email={email} />
        </nav>
      </div>
    </header>
  )
}
