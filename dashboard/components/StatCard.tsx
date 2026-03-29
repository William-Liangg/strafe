'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  value: string | number
  label: string
  sublabel?: string
  accentColor?: string
}

export function StatCard({
  value,
  label,
  sublabel,
  accentColor = '#9f403d',
}: StatCardProps) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
        <p className="text-xs font-semibold text-[#757d6b] uppercase tracking-widest" style={{ fontFamily: 'var(--font-manrope)' }}>
          {label}
        </p>
      </div>
      <div className="text-4xl font-bold text-[#2d3526] tracking-tight" style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sublabel && (
        <p className="text-xs text-[#757d6b] mt-2">{sublabel}</p>
      )}
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
      <div className="h-3 w-28 bg-[#ebf0e0] rounded-full animate-pulse mb-4" />
      <div className="h-10 w-20 bg-[#ebf0e0] rounded-xl animate-pulse mb-3" />
      <div className="h-3 w-24 bg-[#f2f5e8] rounded-full animate-pulse" />
    </div>
  )
}
