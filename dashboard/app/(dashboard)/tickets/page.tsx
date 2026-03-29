'use client'

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Search } from 'lucide-react'
import { useTickets } from '@/lib/hooks'
import { TicketDetailPanel } from '@/components/TicketDetailPanel'
import type { Ticket, TicketPriority, TicketStatus } from '@/lib/types'

// ─── helpers ────────────────────────────────────────────────────────────────

function priorityPip(p: TicketPriority) {
  if (p === 'critical' || p === 'high') return 'bg-[#9f403d]'
  if (p === 'medium') return 'bg-[#a07842]'
  return 'bg-[#b8c4a8]'
}

function priorityLabel(p: TicketPriority): string {
  if (p === 'critical' || p === 'high') return 'HIGH'
  if (p === 'medium') return 'MED'
  return 'LOW'
}

function priorityTextColor(p: TicketPriority): string {
  if (p === 'critical' || p === 'high') return 'text-[#9f403d]'
  if (p === 'medium') return 'text-[#a07842]'
  return 'text-[#757d6b]'
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}


// ─── relationship grouping ───────────────────────────────────────────────────

type DisplayItem = Ticket | { isLabelRow: true; label: string; parentId: string }

function groupTicketsForDisplay(tickets: Ticket[]): DisplayItem[] {
  const result: DisplayItem[] = []
  
  // Find all children mapping
  const childrenMap = new Map<string, Ticket[]>()
  for (const t of tickets) {
    if (t.related_ticket_id) {
      const arr = childrenMap.get(t.related_ticket_id) || []
      arr.push(t)
      childrenMap.set(t.related_ticket_id, arr)
    }
  }

  // Set of IDs already processed
  const processed = new Set<string>()

  for (const t of tickets) {
    if (processed.has(t.id)) continue
    
    // Is it a child? If so, skip rendering it here UNLESS parent is not in this filtered list
    if (t.related_ticket_id) {
      const parentInList = tickets.find(p => p.id === t.related_ticket_id)
      if (parentInList) {
        continue // Parent will process it when its turn comes
      }
    }

    const children = childrenMap.get(t.id) || []
    
    if (children.length > 0) {
      result.push({ 
        isLabelRow: true, 
        label: `⚯ RELATED TICKETS: ${t.jira_ticket_id || 'Ticket'} + ${children.length} dependent`,
        parentId: t.id
      })
      result.push(t)
      processed.add(t.id)
      for (const child of children) {
        result.push(child)
        processed.add(child.id)
      }
    } else {
      result.push(t)
      processed.add(t.id)
    }
  }

  return result
}

// ─── filter tabs ─────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'draft' | 'created' | 'rejected'

const TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Approved', value: 'created' },
  { label: 'Rejected', value: 'rejected' },
]

// ─── page ────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { data, error, mutate } = useTickets()
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const isLoading = !data && !error

  const filtered = useMemo(() => {
    if (!data?.tickets) return []
    return data.tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [data?.tickets, statusFilter, searchQuery])

  const handleUpdate = (updated: Ticket) => {
    if (data) {
      mutate({ ...data, tickets: data.tickets.map((t) => (t.id === updated.id ? updated : t)) }, false)
    }
    setSelected(updated)
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-[#f9faf0]/80 backdrop-blur-[20px] flex justify-between items-center px-8 py-4 shadow-[0px_1px_0px_rgba(184,196,168,0.3)]">
        <div className="flex items-center gap-8">
          <h2
            className="text-2xl font-bold tracking-tight text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}
          >
            Tickets
          </h2>
          <div className="flex gap-1" style={{ fontFamily: 'var(--font-manrope)' }}>
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={
                  statusFilter === tab.value
                    ? 'px-4 py-2 text-sm font-semibold text-[#2d3526] bg-white rounded-2xl shadow-[0px_1px_8px_rgba(45,53,38,0.06)]'
                    : 'px-4 py-2 text-sm font-medium text-[#757d6b] rounded-2xl hover:text-[#2d3526] hover:bg-white/60 transition-colors'
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => mutate()}
          className="px-5 py-2 text-white text-sm font-semibold rounded-2xl transition-opacity hover:opacity-90"
          style={{ fontFamily: 'var(--font-manrope)', background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' }}
        >
          Refresh
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-8 bg-[#f9faf0]">
        {/* Search row */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b8c4a8]" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl text-[#2d3526] placeholder-[#b8c4a8] text-sm focus:outline-none focus:ring-1 focus:ring-[#757d6b] shadow-[0px_1px_8px_rgba(45,53,38,0.04)]"
            />
          </div>
          <span className="text-xs font-medium text-[#757d6b]" style={{ fontFamily: 'var(--font-manrope)' }}>
            {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl shadow-[0px_2px_32px_rgba(45,53,38,0.06)] overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-[#b8c4a8]/10">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-6 py-5 flex items-center gap-4 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-[#ebf0e0]" />
                  <div className="flex-1 h-4 bg-[#ebf0e0] rounded-lg" />
                  <div className="w-20 h-4 bg-[#ebf0e0] rounded-lg" />
                  <div className="w-16 h-4 bg-[#ebf0e0] rounded-lg" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#9f403d] mx-auto mb-3" />
              <p className="text-[#9f403d] font-medium mb-3 text-sm">Failed to load tickets</p>
              <button
                onClick={() => mutate()}
                className="text-[#5f5e5e] text-sm font-semibold hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-[#757d6b] text-sm">
              {data?.tickets.length === 0 ? 'No tickets yet' : 'No tickets match your filters'}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f9faf0]">
                  {['Ticket Title', 'Jira ID', 'Priority', 'Assignee', 'Channel', 'Timestamp'].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-6 py-4 font-semibold text-[#757d6b] text-xs uppercase tracking-widest"
                        style={{ fontFamily: 'var(--font-manrope)' }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {groupTicketsForDisplay(filtered).map((item, idx) => {
                  if ('isLabelRow' in item) {
                    return (
                      <tr key={`label-${item.parentId}`} className="bg-[#f2f5e8] border-t border-[#b8c4a8]/30">
                        <td colSpan={6} className="px-6 py-2">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#2d3526]" style={{ fontFamily: 'var(--font-manrope)' }}>
                            {item.label}
                          </span>
                        </td>
                      </tr>
                    )
                  }

                  const ticket = item as Ticket
                  const isSelected = selected?.id === ticket.id
                  const pip = priorityPip(ticket.priority)
                  const isDraft = ticket.status === 'draft'

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelected(isSelected ? null : ticket)}
                      className={[
                        'cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-[#f2f5e8]'
                          : ticket.related_ticket_id
                          ? 'bg-purple-50 hover:bg-purple-100/50'
                          : idx % 2 === 0
                          ? 'bg-white hover:bg-[#f9faf0]'
                          : 'bg-[#f9faf0]/60 hover:bg-[#f2f5e8]/60',
                      ].join(' ')}
                    >
                      <td className={`px-6 py-4 ${ticket.related_ticket_id ? 'pl-8' : ''}`}>
                        <div className="flex items-center gap-3">
                          {ticket.related_ticket_id && (
                            <span className="text-purple-400 text-xl font-light opacity-50 shrink-0 select-none mt-1">↳</span>
                          )}
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pip} ${isDraft ? 'animate-pulse' : ''}`} />
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-[#2d3526] line-clamp-1" style={{ fontFamily: 'var(--font-manrope)' }}>
                              {ticket.title}
                            </span>
                            {(ticket.story_points || ticket.estimated_hours) && (
                              <span className="text-[#757d6b] text-xs block mt-0.5">
                                {ticket.story_points ? `${ticket.story_points} pts` : ''}
                                {ticket.story_points && ticket.estimated_hours ? ' · ' : ''}
                                {ticket.estimated_hours ? `~${ticket.estimated_hours}h est` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {ticket.jira_ticket_id && ticket.jira_ticket_id !== 'JIRA_ERROR' ? (
                          <span className="font-mono bg-[#f2f5e8] px-2 py-1 rounded-lg text-[#5f5e5e] text-xs">
                            {ticket.jira_ticket_id}
                          </span>
                        ) : (
                          <span className="text-[#b8c4a8] text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs font-semibold ${priorityTextColor(ticket.priority)}`} style={{ fontFamily: 'var(--font-manrope)' }}>
                          {priorityLabel(ticket.priority)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {ticket.suggested_assignee_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#ebf0e0] flex items-center justify-center font-semibold text-[#2d3526] text-[10px] shrink-0">
                              {initials(ticket.suggested_assignee_name)}
                            </div>
                            <span className="text-sm text-[#2d3526]">
                              {ticket.suggested_assignee_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#b8c4a8] text-sm">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-[#757d6b]">
                          {ticket.source_channel_name
                            ? `#${ticket.source_channel_name.replace('#', '')}`
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-[#757d6b]">
                          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {selected && (
        <TicketDetailPanel
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
