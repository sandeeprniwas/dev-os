import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/AuthShell'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const {
    data: { user },
  } = await createClient().auth.getUser()
  if (user) redirect('/dashboard')

  return <AuthShell>{children}</AuthShell>
}
