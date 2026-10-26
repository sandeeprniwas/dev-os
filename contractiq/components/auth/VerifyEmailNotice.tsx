'use client'

import { MailCheck } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { useResendVerification } from '@/hooks/use-resend-verification'
import { AuthAlert } from './AuthAlert'

export function VerifyEmailNotice() {
  const email = useSearchParams().get('email') ?? ''
  const { resend, cooldown, pending, status } = useResendVerification(email)

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <MailCheck className="h-10 w-10 text-brand" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="text-h5 text-fg">Check your inbox</h1>
        <p className="text-body text-fg-muted">
          {email ? (
            <>
              We sent a confirmation link to <strong className="font-medium text-fg">{email}</strong>. Click it to
              finish setting up your account.
            </>
          ) : (
            'We sent you a confirmation link. Click it to finish setting up your account.'
          )}
        </p>
      </div>

      {status && <AuthAlert tone={status.tone}>{status.message}</AuthAlert>}

      <div className="flex w-full flex-col gap-3">
        {email && (
          <Button variant="secondary" onClick={resend} loading={pending} disabled={cooldown > 0} className="w-full">
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          </Button>
        )}
        <Button variant="ghost" asChild className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    </div>
  )
}
