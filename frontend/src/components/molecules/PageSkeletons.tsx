import { cn } from '@/utils/cn'

type SkeletonProps = {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-sm bg-gray-200/70', className)} aria-hidden />
}

function MetricCardSkeleton() {
  return (
    <div className="rounded-sm border border-ui-border bg-ui-surface p-4 shadow-sm">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-20" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  )
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6" aria-busy aria-label="Loading dashboard">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-full max-w-xl" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-sm border border-ui-border lg:col-span-2" />
        <Skeleton className="h-72 rounded-sm border border-ui-border" />
      </div>
      <Skeleton className="h-52 rounded-sm border border-ui-border" />
    </div>
  )
}

export function MetricsPanelSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading metrics">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-sm border border-ui-border lg:col-span-2" />
        <Skeleton className="h-40 rounded-sm border border-ui-border" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function TablePageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading table">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="overflow-hidden rounded-sm border border-ui-border bg-ui-surface">
        <Skeleton className="h-11 w-full rounded-none" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-ui-border px-4 py-3">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="hidden h-4 w-1/6 sm:block" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3" aria-busy aria-label="Loading list">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-sm border border-ui-border bg-ui-surface p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProfilePageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6" aria-busy aria-label="Loading profile">
      <Skeleton className="h-10 w-48" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="rounded-sm border border-ui-border bg-ui-surface p-6 lg:w-72">
          <Skeleton className="mx-auto h-24 w-24 rounded-full" />
          <Skeleton className="mx-auto mt-4 h-5 w-40" />
          <Skeleton className="mx-auto mt-2 h-4 w-52" />
          <Skeleton className="mt-6 h-10 w-full" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-sm border border-ui-border bg-ui-surface p-4">
              <Skeleton className="h-4 w-36" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((__, j) => (
                  <div key={j} className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FormPageSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading form">
      <Skeleton className="h-10 w-56" />
      <div className="rounded-sm border border-ui-border bg-ui-surface p-5 space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  )
}

export function InlineBlockSkeleton() {
  return (
    <div className="space-y-3 py-4" aria-busy aria-label="Loading">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-24 w-full rounded-sm border border-ui-border" />
    </div>
  )
}
