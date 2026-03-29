'use client'

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn('bg-[#ebf0e0] rounded-xl animate-pulse', className)}
      style={style}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
      <Skeleton className="h-7 w-24 mb-3" />
      <Skeleton className="h-4 w-36 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
      <Skeleton className="h-5 w-48 mb-5" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
      <Skeleton className="h-5 w-48 mb-5" />
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function TicketRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-4">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
    </div>
  )
}
