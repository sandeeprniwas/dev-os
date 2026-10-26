import type { ReactNode } from 'react'
import { Logo } from '@/components/layout/Logo'
import { SkipToContent } from '@/components/layout/SkipToContent'
import { Card } from '@/components/ui/Card'

/** Centered card layout shared by sign-in, sign-up, password-reset and verification pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-page px-4 py-12">
      <SkipToContent />
      <Logo />
      <main id="main" className="w-full max-w-[400px]">
        <Card padding={8}>{children}</Card>
      </main>
      <p className="max-w-[400px] text-center text-body-sm text-fg-muted">
        ContractIQ is an AI-assisted review tool, not legal advice.
      </p>
    </div>
  )
}
