import { Skeleton } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
