import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/AuthShell'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Choose a new password' }
export const dynamic = 'force-dynamic'

/** Reached from the password-recovery email via /auth/callback, which establishes a recovery session. */
export default async function ResetPasswordPage() {
  const {
    data: { user },
  } = await createClient().auth.getUser()
  if (!user) redirect('/login?error=link_expired')

  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  )
}
