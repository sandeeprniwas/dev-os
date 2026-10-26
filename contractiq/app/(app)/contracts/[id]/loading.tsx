import { Skeleton } from '@/components/ui/Skeleton'

export default function ContractLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading contract">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-9 w-full" />
      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-full min-h-[400px]" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
