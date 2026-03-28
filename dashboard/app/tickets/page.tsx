'use client'

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Search, Bot, UserCheck, Clock } from 'lucide-react'
import { useTickets } from '@/lib/hooks'
import { StatusBadge, PriorityBadge, OriginBadge } from '@/components/TicketBadge'
import { TableSkeleton } from '@/components/LoadingSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { TicketDetailPanel } from '@/components/TicketDetailPanel'
import type { Ticket } from '@/lib/types'

function DecisionBadge({ ticket }: { ticket: Ticket }) {
  // Auto-approved: status=created and trigger_mode=automatic
  if (ticket.status === 'created' && ticket.trigger_mode === 'automatic') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <Bot className="h-3 w-3" />
        Auto
      </span>
    )
  }

  // Manager approved: status=created and not automatic
  if (ticket.status === 'created') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <UserCheck className="h-3 w-3" />
        Approved
      </span>
    )
  }

  // Pending: status=draft
  if (ticket.status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    )
  }

  // Rejected or other
  return <span className="text-sm text-gray-400">—</span>
}

type StatusFilter = 'all' | 'draft' | 'created' | 'rejected'

export default function TicketsPage() {
  const { data, error, mutate } = useTickets()
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const isLoading = !data && !error

  const filteredTickets = useMemo(() => {
    if (!data?.tickets) return []

    return data.tickets.filter((ticket) => {
      // Status filter
      if (statusFilter !== 'all' && ticket.status !== statusFilter) {
        return false
      }

      // Search filter (case-insensitive title match)
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!ticket.title.toLowerCase().includes(query)) {
          return false
        }
      }

      return true
    })
  }, [data?.tickets, statusFilter, searchQuery])

  const handleTicketUpdate = (updatedTicket: Ticket) => {
    // Update the ticket in the cache
    if (data) {
      mutate({
        ...data,
        tickets: data.tickets.map((t) =>
          t.id === updatedTicket.id ? updatedTicket : t
        ),
      }, false)
    }
    setSelectedTicket(updatedTicket)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>

      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="created">Created</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Count */}
        <span className="text-sm text-gray-500">
          Showing {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={10} />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState onRetry={() => mutate()} />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {data?.tickets.length === 0
              ? 'No tickets found'
              : 'No tickets match your filters'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Title
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Priority
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Decision
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Points
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Assignee
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Channel
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Origin
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900 line-clamp-1">
                      {ticket.title}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="px-4 py-4">
                    <DecisionBadge ticket={ticket} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm text-gray-600 block">
                      {ticket.story_points}
                    </span>
                    {ticket.estimated_hours && (
                      <span className="text-xs text-gray-400 block mt-0.5">
                        ~{ticket.estimated_hours}h
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600">
                      {ticket.suggested_assignee_name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-gray-600">
                      {ticket.source_channel_name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <OriginBadge origin={ticket.origin_type} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(ticket.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ticket Detail Panel */}
      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleTicketUpdate}
        />
      )}
    </div>
  )
}
