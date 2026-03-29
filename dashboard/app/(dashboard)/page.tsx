'use client'

import { useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Bot } from 'lucide-react'
import { useAgentDecisions, useAgentStatus, useSummary, useTickets } from '@/lib/hooks'
import type { Ticket, AgentDecision } from '@/lib/types'
import { approveTicket, rejectTicket } from '@/lib/api'

function LoadingBar({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="fixed top-0 left-64 right-0 z-50 h-1 overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r from-[#5f5e5e] via-[#3a6b4a] to-[#5f5e5e] transition-all duration-300 ${
          isLoading ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backgroundSize: '200% 100%',
          animation: isLoading ? 'loading-shimmer 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <style jsx>{`
        @keyframes loading-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────────

type Priority = Ticket['priority']

function priorityMeta(priority: Priority) {
  switch (priority) {
    case 'critical':
    case 'high':
      return { label: 'Urgent Priority', pip: 'bg-[#9f403d]', labelClass: 'text-[#9f403d]' }
    case 'medium':
      return { label: 'Medium Priority', pip: 'bg-[#a07842]', labelClass: 'text-[#a07842]' }
    default:
      return { label: 'Routine Request', pip: 'bg-[#b8c4a8]', labelClass: 'text-[#757d6b]' }
  }
}

function decisionMeta(action: string) {
  switch (action) {
    case 'auto_assigned':
      return { label: 'Auto-assigned', pip: 'bg-[#3a6b4a]', labelClass: 'text-[#3a6b4a]' }
    case 'dismissed':
      return { label: 'Dismissed', pip: 'bg-[#b8c4a8]', labelClass: 'text-[#757d6b]' }
    default:
      return { label: 'Flagged for Review', pip: 'bg-[#5f5e5e]', labelClass: 'text-[#5f5e5e]' }
  }
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

// ─── feed cards ─────────────────────────────────────────────────────────────

function DraftTicketCard({
  ticket,
  reasoning,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  ticket: Ticket
  reasoning?: string
  onApprove: () => void
  onReject: () => void
  isApproving: boolean
  isRejecting: boolean
}) {
  const meta = priorityMeta(ticket.priority)
  const channelDisplay = ticket.source_channel_name
    ? `#${ticket.source_channel_name.replace('#', '')}`
    : '#unknown'

  return (
    <article className="bg-white rounded-3xl p-7 shadow-[0px_2px_32px_rgba(45,53,38,0.06)]">
      <div className="flex justify-between items-start mb-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.pip}`} />
            <span
              className={`${meta.labelClass} font-semibold text-xs uppercase tracking-wide`}
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {meta.label}
            </span>
            <span className="text-[#b8c4a8] text-xs">·</span>
            <span className="text-[#757d6b] text-sm">{channelDisplay}</span>
          </div>
          <h3
            className="text-xl font-bold leading-tight text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}
          >
            {ticket.title}
          </h3>
        </div>
        <span className="text-xs text-[#757d6b] shrink-0 ml-6">
          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
        </span>
      </div>

      {(ticket.description || reasoning) && (
        <div className="mb-6 pl-4 border-l-2 border-[#ebf0e0]">
          <p className="text-[#757d6b] text-sm leading-relaxed italic">
            &ldquo;{reasoning ?? ticket.description}&rdquo;
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-5 border-t border-[#b8c4a8]/20">
        <div className="flex items-center gap-3">
          {ticket.suggested_assignee_name && (
            <>
              <div className="w-9 h-9 rounded-xl bg-[#f2f5e8] flex items-center justify-center font-semibold text-[#2d3526] text-xs">
                {initials(ticket.suggested_assignee_name)}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-[#757d6b] uppercase tracking-widest" style={{ fontFamily: 'var(--font-manrope)' }}>
                  Suggested Assignee
                </p>
                <p className="text-sm font-semibold text-[#2d3526]">{ticket.suggested_assignee_name}</p>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReject}
            disabled={isApproving || isRejecting}
            className="px-4 py-2 text-[#757d6b] text-sm font-medium rounded-2xl hover:bg-[#f2f5e8] transition-colors disabled:opacity-40"
          >
            Dismiss
          </button>
          <button
            onClick={onApprove}
            disabled={isApproving || isRejecting}
            className="px-5 py-2 text-white text-sm font-semibold rounded-2xl disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ fontFamily: 'var(--font-manrope)', background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' }}
          >
            {isApproving ? 'Approving…' : 'Approve → Jira'}
          </button>
        </div>
      </div>
    </article>
  )
}

function DecisionCard({ decision }: { decision: AgentDecision }) {
  const meta = decisionMeta(decision.action)
  const channelDisplay = `#${decision.channel_name.replace('#', '')}`

  return (
    <article className="bg-white rounded-3xl p-7 shadow-[0px_2px_32px_rgba(45,53,38,0.04)] opacity-90">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.pip}`} />
            <span
              className={`${meta.labelClass} font-semibold text-xs uppercase tracking-wide`}
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {meta.label}
            </span>
            <span className="text-[#b8c4a8] text-xs">·</span>
            <span className="text-[#757d6b] text-sm">{channelDisplay}</span>
          </div>
          <h3
            className="text-xl font-bold leading-tight text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}
          >
            {decision.action === 'auto_assigned' && decision.assignee_name
              ? `Assigned to ${decision.assignee_name}`
              : decision.jira_ticket_id ?? 'Decision recorded'}
          </h3>
        </div>
        <span className="text-xs text-[#757d6b] shrink-0 ml-6">
          {formatDistanceToNow(new Date(decision.created_at), { addSuffix: true })}
        </span>
      </div>

      {decision.reasoning && (
        <div className="mb-5 pl-4 border-l-2 border-[#ebf0e0]">
          <p className="text-[#757d6b] text-sm leading-relaxed italic">
            &ldquo;{decision.reasoning}&rdquo;
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-5 border-t border-[#b8c4a8]/20">
        <div>
          {decision.story_points && (
            <span className="text-xs text-[#757d6b]">
              {decision.story_points} pts · {(decision.confidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
        {decision.jira_ticket_id && (
          <span className="text-xs font-mono text-[#5f5e5e] bg-[#f2f5e8] px-2 py-1 rounded-lg">
            {decision.jira_ticket_id}
          </span>
        )}
      </div>
    </article>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function AgentPage() {
  const { data: agentStatus, mutate: mutateStatus } = useAgentStatus()
  const { data: decisionsData, mutate: mutateDecisions } = useAgentDecisions(undefined, 50)
  const { data: summary, mutate: mutateSummary } = useSummary()
  const { data: ticketsData, mutate: mutateTickets } = useTickets()

  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const decisions = decisionsData?.decisions ?? []
  const draftTickets = ticketsData?.tickets.filter((t) => t.status === 'draft') ?? []

  const getReasoningForTicket = (ticketId: string) =>
    decisions.find((d) => d.ticket_id === ticketId)?.reasoning

  const handleApprove = async (ticket: Ticket) => {
    setApprovingId(ticket.id)
    try {
      await approveTicket(ticket.id)
      mutateTickets()
      mutateDecisions()
      mutateSummary()
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async (ticket: Ticket) => {
    setRejectingId(ticket.id)
    try {
      await rejectTicket(ticket.id, 'Rejected via agent dashboard')
      mutateTickets()
      mutateDecisions()
    } finally {
      setRejectingId(null)
    }
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)

    // Run all mutations in parallel with a minimum loading time for UX
    await Promise.all([
      mutateStatus(),
      mutateDecisions(),
      mutateSummary(),
      mutateTickets(),
      new Promise((resolve) => setTimeout(resolve, 800)),
    ])

    setIsRefreshing(false)
  }, [mutateStatus, mutateDecisions, mutateSummary, mutateTickets])

  const completedDecisions = decisions.filter(
    (d) => d.action !== 'flagged_for_review' || !draftTickets.find((t) => t.id === d.ticket_id)
  )

  const confidencePct = agentStatus?.avg_confidence_today
    ? Math.round(agentStatus.avg_confidence_today * 100)
    : 0

  const sprintPct = summary?.current_sprint?.adhoc_percentage ?? 0
  const sprintDirection = (summary as any)?.comparison_to_last_sprint?.direction as 'up' | 'down' | undefined

  return (
    <div className="flex flex-col min-h-screen bg-[#f9faf0]">
      <LoadingBar isLoading={isRefreshing} />

      {/* ── Top nav ── */}
      <header className="sticky top-0 z-40 bg-[#f9faf0]/80 backdrop-blur-[20px] flex justify-between items-center px-8 py-4 shadow-[0px_1px_0px_rgba(184,196,168,0.3)]">
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-bold tracking-tight text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}
          >
            Live Feed
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#f2f5e8] text-[10px] font-semibold text-[#9f403d] uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9f403d] animate-pulse" />
            Realtime
          </span>
        </div>
        <div className="flex items-center gap-6">
          {agentStatus && (
            <span className="hidden md:block text-sm text-[#757d6b]">
              {agentStatus.monitored_channels} channels · {agentStatus.decisions_today} decisions today
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-5 py-2 text-white text-sm font-semibold rounded-2xl transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-manrope)', background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' }}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Feed'}
          </button>
        </div>
      </header>

      <main className="flex-1 px-8 py-8 space-y-8">

        {/* ── Row 1: Stat cards ── */}
        <section className="grid grid-cols-3 gap-6">

          {/* System Load */}
          <div className="relative bg-[#ebf0e0] border-2 border-[#2d3526] p-6 overflow-hidden shadow-[4px_4px_0px_0px_#2d3526]">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#5f5e5e]" />
            <div className="pl-4">
              <p className="text-xs font-black uppercase tracking-widest text-[#b8c4a8] mb-3" style={{ fontFamily: 'var(--font-manrope)' }}>
                System Load
              </p>
              <p className="text-4xl font-black text-[#2d3526]" style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}>
                {draftTickets.length}
              </p>
              <p className="text-xs text-[#757d6b] mt-1">
                Active threads · {confidencePct}% queue health
              </p>
            </div>
          </div>

          {/* Performance */}
          <div className="relative bg-[#ebf0e0] border-2 border-[#2d3526] p-6 overflow-hidden shadow-[4px_4px_0px_0px_#2d3526]">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#d8e2c8]" />
            <div className="pl-4">
              <p className="text-xs font-black uppercase tracking-widest text-[#b8c4a8] mb-3" style={{ fontFamily: 'var(--font-manrope)' }}>
                Performance
              </p>
              <p className="text-4xl font-black text-[#2d3526]" style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}>
                {confidencePct > 0 ? `${confidencePct}%` : '—'}
              </p>
              <p className="text-xs text-[#757d6b] mt-1">Avg confidence today</p>
            </div>
          </div>

          {/* Sprint Health */}
          <div className="relative bg-[#ebf0e0] border-2 border-[#2d3526] p-6 overflow-hidden shadow-[4px_4px_0px_0px_#2d3526]">
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${sprintPct > 20 ? 'bg-[#9f403d]' : 'bg-[#5f5e5e]'}`} />
            <div className="pl-4">
              <p className="text-xs font-black uppercase tracking-widest text-[#b8c4a8] mb-3" style={{ fontFamily: 'var(--font-manrope)' }}>
                Sprint Health
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-[#2d3526]" style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}>
                  {summary?.current_sprint ? `${sprintPct.toFixed(1)}%` : '—'}
                </p>
                {sprintDirection && (
                  <span className={`text-sm font-bold ${sprintDirection === 'up' ? 'text-[#9f403d]' : 'text-[#3a6b4a]'}`}>
                    {sprintDirection === 'up' ? '▲' : '▼'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#757d6b] mt-1">adhoc this sprint</p>
            </div>
          </div>
        </section>

        {/* ── Row 2: Section header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-2xl font-black uppercase tracking-tight text-[#2d3526]"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Recent Dispatches
            </h2>
            <p className="text-sm text-[#757d6b] mt-0.5">
              Slack threads detected and queued for approval
            </p>
          </div>
          {draftTickets.length > 0 && (
            <span
              className="bg-[#ebf0e0] border-2 border-[#2d3526] px-3 py-1 font-black text-sm text-[#2d3526] shadow-[2px_2px_0px_0px_#2d3526]"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {draftTickets.length} pending
            </span>
          )}
        </div>

        {/* ── Row 3: Dispatch cards ── */}
        <section className="space-y-5">
          {draftTickets.length === 0 && completedDecisions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <Bot className="h-8 w-8 text-[#b8c4a8]" />
              <p className="text-lg font-semibold text-[#2d3526]" style={{ fontFamily: 'var(--font-manrope)' }}>
                No activity yet
              </p>
              <p className="text-sm text-[#757d6b]">
                The agent will post here as it processes Slack threads.
              </p>
            </div>
          )}

          {draftTickets.map((ticket) => (
            <DraftTicketCard
              key={ticket.id}
              ticket={ticket}
              reasoning={getReasoningForTicket(ticket.id)}
              onApprove={() => handleApprove(ticket)}
              onReject={() => handleReject(ticket)}
              isApproving={approvingId === ticket.id}
              isRejecting={rejectingId === ticket.id}
            />
          ))}

          {completedDecisions.slice(0, 20).map((decision) => (
            <DecisionCard key={decision.id} decision={decision} />
          ))}
        </section>

      </main>
    </div>
  )
}
