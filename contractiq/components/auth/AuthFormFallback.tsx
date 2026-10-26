import { Skeleton } from '@/components/ui/Skeleton'

/** Suspense fallback while a client auth form reads search params. */
export function AuthFormFallback() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}
