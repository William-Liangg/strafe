'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  value: string | number
  label: string
  sublabel?: string
  borderColor?: string
  valueColor?: string
}

export function StatCard({
  value,
  label,
  sublabel,
  borderColor = '#E2534A',
  valueColor,
}: StatCardProps) {
  return (
    <div
      className="bg-white rounded-lg p-5 shadow-sm"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div
        className={cn('text-3xl font-bold mb-1', valueColor)}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      {sublabel && (
        <div className="text-xs text-gray-400">{sublabel}</div>
      )}
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border-l-[3px] border-gray-200">
      <div className="h-9 w-24 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-1" />
      <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
    </div>
  )
}
