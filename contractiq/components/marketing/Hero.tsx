import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ProductPreview } from './ProductPreview'

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="grid items-center gap-12 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <h1 className="text-h2 text-fg md:text-h1">Understand any NDA or MSA in minutes, not hours</h1>
        <p className="max-w-[640px] text-body-lg text-fg-muted">
          Upload a contract and ContractIQ pulls out the terms that matter — each with the page it came from, a
          confidence score, and the exact sentence it&apos;s based on. Then ask follow-up questions in plain English.
        </p>
        <div className="flex flex-wrap gap-3">
          {signedIn ? (
            <Button size="lg" asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild>
                <Link href="/signup">Get started free</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <ProductPreview />
    </section>
  )
}
