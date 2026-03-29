'use client'

import { cn } from '@/lib/utils'
import type { TicketPriority, TicketStatus, OriginType } from '@/lib/types'

interface BadgeProps {
  className?: string
  children: React.ReactNode
}

function Badge({ className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium',
        className
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, string> = {
    draft: 'bg-[#f2f5e8] text-[#2d3526]',
    approved: 'bg-[#f2f5e8] text-[#3a6b4a]',
    rejected: 'bg-[#f2f5e8] text-[#9f403d]',
    created: 'bg-[#f2f5e8] text-[#3a6b4a]',
  }

  const pipColors: Record<TicketStatus, string> = {
    draft: 'bg-[#757d6b]',
    approved: 'bg-[#3a6b4a]',
    rejected: 'bg-[#9f403d]',
    created: 'bg-[#3a6b4a]',
  }

  const labels: Record<TicketStatus, string> = {
    draft: 'Draft',
    approved: 'Approved',
    rejected: 'Rejected',
    created: 'Created',
  }

  return (
    <Badge className={styles[status]}>
      <span className={`w-1.5 h-1.5 rounded-full ${pipColors[status]}`} />
      {labels[status]}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const pipColors: Record<TicketPriority, string> = {
    critical: 'bg-[#9f403d]',
    high: 'bg-[#9f403d]',
    medium: 'bg-[#a07842]',
    low: 'bg-[#b8c4a8]',
  }

  const textColors: Record<TicketPriority, string> = {
    critical: 'text-[#9f403d]',
    high: 'text-[#9f403d]',
    medium: 'text-[#a07842]',
    low: 'text-[#757d6b]',
  }

  const labels: Record<TicketPriority, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }

  return (
    <Badge className={`bg-[#f2f5e8] ${textColors[priority]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${pipColors[priority]}`} />
      {labels[priority]}
    </Badge>
  )
}

export function OriginBadge({ origin }: { origin: OriginType }) {
  const styles: Record<OriginType, string> = {
    adhoc: 'bg-[#f2f5e8] text-[#5f5e5e]',
    planned: 'bg-[#f2f5e8] text-[#757d6b]',
  }

  const labels: Record<OriginType, string> = {
    adhoc: 'Adhoc',
    planned: 'Planned',
  }

  return <Badge className={styles[origin]}>{labels[origin]}</Badge>
}
