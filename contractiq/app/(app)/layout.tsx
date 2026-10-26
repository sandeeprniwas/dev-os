import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { SkipToContent } from '@/components/layout/SkipToContent'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Authenticated shell. Re-checks the session server-side (middleware is not the only gate). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-page">
      <SkipToContent />
      <AppHeader email={user.email ?? ''} />
      <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
        {children}
      </main>
    </div>
  )
}
