import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Logo } from './Logo'

export function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-6 md:px-28">
        <Logo />
        <nav aria-label="Account" className="flex items-center gap-2">
          {signedIn ? (
            <Button size="sm" asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              {/* Hidden on phones: the hero directly below repeats "Sign in". */}
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Get started free</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
