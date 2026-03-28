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
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        className
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, string> = {
    draft: 'bg-amber-100 text-amber-800',
    approved: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
    created: 'bg-green-100 text-green-800',
  }

  const labels: Record<TicketStatus, string> = {
    draft: 'Draft',
    approved: 'Approved',
    rejected: 'Rejected',
    created: 'Created',
  }

  return <Badge className={styles[status]}>{labels[status]}</Badge>
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const styles: Record<TicketPriority, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-slate-100 text-slate-800',
  }

  const labels: Record<TicketPriority, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }

  return <Badge className={styles[priority]}>{labels[priority]}</Badge>
}

export function OriginBadge({ origin }: { origin: OriginType }) {
  const styles: Record<OriginType, string> = {
    adhoc: 'bg-purple-100 text-purple-800',
    planned: 'bg-slate-100 text-slate-800',
  }

  const labels: Record<OriginType, string> = {
    adhoc: 'Adhoc',
    planned: 'Planned',
  }

  return <Badge className={styles[origin]}>{labels[origin]}</Badge>
}
