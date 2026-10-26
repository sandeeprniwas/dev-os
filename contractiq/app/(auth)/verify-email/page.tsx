import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AuthFormFallback } from '@/components/auth/AuthFormFallback'
import { VerifyEmailNotice } from '@/components/auth/VerifyEmailNotice'

export const metadata: Metadata = { title: 'Check your inbox' }

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <VerifyEmailNotice />
    </Suspense>
  )
}
