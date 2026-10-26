import type { Metadata } from 'next'
import { MarketingFooter } from '@/components/layout/MarketingFooter'
import { MarketingHeader } from '@/components/layout/MarketingHeader'
import { SkipToContent } from '@/components/layout/SkipToContent'
import { FeatureGrid } from '@/components/marketing/FeatureGrid'
import { Hero } from '@/components/marketing/Hero'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'ContractIQ — Understand NDAs and MSAs in minutes' },
  openGraph: {
    title: 'ContractIQ — Understand NDAs and MSAs in minutes',
    description: 'Key terms with page references, confidence scores and a chat grounded in your contract.',
  },
}

async function isSignedIn(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await createClient().auth.getUser()
    return Boolean(user)
  } catch (error) {
    logger.warn('landing_session_check_failed', { error })
    return false
  }
}

export default async function LandingPage() {
  const signedIn = await isSignedIn()

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <SkipToContent />
      <MarketingHeader signedIn={signedIn} />
      <main id="main" className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-16 px-6 py-12 md:px-28 md:py-24">
        <Hero signedIn={signedIn} />
        <FeatureGrid />
      </main>
      <MarketingFooter />
    </div>
  )
}
