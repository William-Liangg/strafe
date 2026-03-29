'use client'

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Search } from 'lucide-react'
import { useTickets } from '@/lib/hooks'
import { TicketDetailPanel } from '@/components/TicketDetailPanel'
import type { Ticket, TicketPriority, TicketStatus } from '@/lib/types'

// ─── helpers ────────────────────────────────────────────────────────────────

function priorityStripe(p: TicketPriority) {
  if (p === 'critical' || p === 'high') return 'bg-[#ff6e84]'
  if (p === 'medium') return 'bg-amber-500'
  return 'bg-slate-600'
}

function priorityBadge(p: TicketPriority) {
  if (p === 'critical' || p === 'high')
    return 'bg-[#ff6e84] border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
  if (p === 'medium')
    return 'bg-amber-500/10 text-amber-500 border border-amber-500'
  return 'bg-slate-700 text-slate-400 border border-slate-600'
}

function statusRowStyle(status: TicketStatus, isSelected: boolean) {
  if (isSelected) return 'bg-[#bd9dff]/10 border-l-4 border-l-[#bd9dff] cursor-pointer'
  if (status === 'draft') return 'border-l-4 border-l-[#bd9dff]/30 hover:bg-[#bd9dff]/5 cursor-pointer transition-colors'
  if (status === 'rejected') return 'opacity-60 hover:bg-[#bd9dff]/5 cursor-pointer transition-colors'
  return 'hover:bg-[#bd9dff]/5 cursor-pointer transition-colors'
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
      <header
        className="sticky top-0 z-30 border-b-4 border-black bg-slate-900/80 backdrop-blur-md flex justify-between items-center px-8 py-4 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="flex items-center gap-6">
          <h2
            className="text-3xl font-black italic tracking-tighter text-slate-50"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Tickets
          </h2>
          <div
            className="flex gap-4 font-black text-lg"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={
                  statusFilter === tab.value
                    ? 'text-violet-400 relative after:content-[""] after:absolute after:-bottom-1 after:left-0 after:w-full after:h-[3px] after:bg-violet-400'
                    : 'text-slate-300 hover:text-violet-400 transition-colors'
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => mutate()}
          className="bg-[#bd9dff] text-[#3c0089] px-6 py-2 border-2 border-black font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 duration-100"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Refresh
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-8 bg-[#060e20]">
        {/* Search row */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6d758c]" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0f1930] border-2 border-black text-[#dee5ff] placeholder-[#6d758c] text-sm focus:outline-none focus:border-[#bd9dff]"
            />
          </div>
          <span
            className="text-xs font-bold text-[#6d758c] uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="bg-[#0f1930] border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          {isLoading ? (
            <div className="divide-y-2 divide-black/10">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-6 py-5 flex items-center gap-4 animate-pulse">
                  <div className="w-2 h-8 bg-[#192540]" />
                  <div className="flex-1 h-4 bg-[#192540]" />
                  <div className="w-20 h-4 bg-[#192540]" />
                  <div className="w-16 h-4 bg-[#192540]" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-[#ff6e84] font-bold mb-3">Failed to load tickets</p>
              <button
                onClick={() => mutate()}
                className="text-[#bd9dff] text-sm font-bold hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-[#6d758c]">
              {data?.tickets.length === 0 ? 'No tickets yet' : 'No tickets match your filters'}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#141f38] border-b-2 border-black">
                  {['Ticket Title', 'Jira ID', 'Priority', 'Assignee', 'Channel', 'Timestamp'].map(
                    (col) => (
                      <th
                        key={col}
                        className="px-6 py-4 font-black uppercase tracking-tighter text-[#40485d] text-xs"
                        style={{ fontFamily: 'var(--font-space-grotesk)' }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10">
                {groupTicketsForDisplay(filtered).map((item) => {
                  if ('isLabelRow' in item) {
                    return (
                      <tr key={`label-${item.parentId}`} className="bg-[#192540]/60 border-t-4 border-black">
                        <td colSpan={6} className="px-6 py-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#bd9dff]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                            {item.label}
                          </span>
                        </td>
                      </tr>
                    )
                  }

                  const ticket = item as Ticket
                  const isSelected = selected?.id === ticket.id
                  const stripe = priorityStripe(ticket.priority)
                  const badge = priorityBadge(ticket.priority)
                  const channel = ticket.source_channel_name
                    ? `#${ticket.source_channel_name.replace('#', '')}`
                    : '—'

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelected(isSelected ? null : ticket)}
                      className={`${statusRowStyle(ticket.status, isSelected)} ${ticket.related_ticket_id ? 'bg-[#bd9dff]/5' : ''}`}
                    >
                      <td className={`px-6 py-5 ${ticket.related_ticket_id ? 'pl-8' : ''}`}>
                        <div className="flex items-center gap-3">
                          {ticket.related_ticket_id && (
                            <span className="text-[#bd9dff] text-xl font-light opacity-50 shrink-0 select-none mt-1">↳</span>
                          )}
                          <div
                            className={`w-2 h-8 shrink-0 shadow-[2px_0px_0px_0px_rgba(0,0,0,1)] ${stripe} ${
                              ticket.status === 'draft' ? 'animate-pulse' : ''
                            }`}
                          />
                          <div className="flex flex-col">
                            <span
                              className="font-bold text-base tracking-tight text-white line-clamp-1"
                            >
                              {ticket.title}
                            </span>
                            {(ticket.story_points || ticket.estimated_hours) && (
                              <span className="text-[#6d758c] text-[10px] font-bold uppercase tracking-widest block mt-0.5">
                                {ticket.story_points ? `${ticket.story_points} PTS` : ''}
                                {ticket.story_points && ticket.estimated_hours ? ' · ' : ''}
                                {ticket.estimated_hours ? `~${ticket.estimated_hours}H EST` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        {ticket.jira_ticket_id && ticket.jira_ticket_id !== 'JIRA_ERROR' ? (
                          <span className="font-mono bg-black/40 px-2 py-1 border border-[#40485d] text-[#a88cfb] text-sm">
                            {ticket.jira_ticket_id}
                          </span>
                        ) : (
                          <span className="text-[#40485d] text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`px-2 py-0.5 text-xs font-black ${badge}`}
                          style={{ fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {ticket.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {ticket.suggested_assignee_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 border-2 border-black bg-[#bd9dff] flex items-center justify-center font-black text-[#3c0089] text-[10px] shrink-0">
                              {initials(ticket.suggested_assignee_name)}
                            </div>
                            <span
                              className={`text-sm font-medium ${isSelected ? 'text-[#bd9dff] font-bold' : 'text-[#dee5ff]'}`}
                            >
                              {ticket.suggested_assignee_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#6d758c] text-sm">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`text-xs ${isSelected ? 'font-bold text-[#dee5ff] px-2 py-1 bg-black/20 border border-black' : 'text-[#6d758c]'}`}
                        >
                          {channel}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`text-sm font-mono ${isSelected ? 'text-[#dee5ff] font-bold' : 'text-[#a3aac4]'}`}
                        >
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

      {/* Detail panel */}
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
