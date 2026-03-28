'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Bot, Zap, RefreshCw, Check, X, ArrowRight } from 'lucide-react'
import { useAgentDecisions, useAgentStatus, useSummary, useTickets } from '@/lib/hooks'
import type { Ticket, AgentDecision } from '@/lib/types'
import { approveTicket, rejectTicket } from '@/lib/api'

// ─── helpers ────────────────────────────────────────────────────────────────

type Priority = Ticket['priority']

function priorityMeta(priority: Priority) {
  switch (priority) {
    case 'critical':
    case 'high':
      return {
        label: 'Urgent Priority',
        stripe: 'bg-[#ff6e84]',
        shadow: 'shadow-[8px_8px_0px_0px_#ff6e84]',
        labelClass: 'text-[#ff6e84]',
      }
    case 'medium':
      return {
        label: 'Medium Priority',
        stripe: 'bg-[#bd9dff]',
        shadow: 'shadow-[8px_8px_0px_0px_#bd9dff]',
        labelClass: 'text-[#bd9dff]',
      }
    default:
      return {
        label: 'Routine Request',
        stripe: 'bg-[#6d758c]',
        shadow: 'shadow-[8px_8px_0px_0px_#6d758c]',
        labelClass: 'text-[#6d758c]',
      }
  }
}

function decisionMeta(action: string) {
  switch (action) {
    case 'auto_assigned':
      return { label: 'Auto-assigned', stripe: 'bg-green-500', shadow: 'shadow-[8px_8px_0px_0px_#22c55e]', labelClass: 'text-green-400' }
    case 'dismissed':
      return { label: 'Dismissed', stripe: 'bg-[#6d758c]', shadow: 'shadow-[8px_8px_0px_0px_#6d758c]', labelClass: 'text-[#a3aac4]' }
    default:
      return { label: 'Flagged for Review', stripe: 'bg-[#bd9dff]', shadow: 'shadow-[8px_8px_0px_0px_#bd9dff]', labelClass: 'text-[#bd9dff]' }
  }
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
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
    <article
      className={`relative group bg-[#0f1930] border-4 border-black p-6 glass-sheen ${meta.shadow}`}
    >
      <div className={`absolute top-0 left-0 w-1.5 h-full ${meta.stripe}`} />

      <div className="flex justify-between items-start mb-4 pl-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className={`${meta.labelClass} font-black text-xs uppercase tracking-tighter`} style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {meta.label}
            </span>
            <span className="text-[#40485d] text-xs">•</span>
            <span className="font-black text-[#bd9dff] text-sm" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {channelDisplay}
            </span>
            {(ticket.story_points || ticket.estimated_hours) && (
              <>
                <span className="text-[#40485d] text-xs">•</span>
                <span className="font-bold text-[#6d758c] text-xs uppercase tracking-widest mt-0.5">
                  {ticket.story_points ? `${ticket.story_points} pts` : ''}
                  {ticket.story_points && ticket.estimated_hours ? ' · ' : ''}
                  {ticket.estimated_hours ? `~${ticket.estimated_hours}h` : ''}
                </span>
              </>
            )}
          </div>
          <h3
            className="text-xl font-black leading-tight text-white tracking-tight"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {ticket.title}
          </h3>
        </div>
        <span className="text-sm font-mono text-[#6d758c] font-bold shrink-0 ml-4">
          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
        </span>
      </div>

      {(ticket.description || reasoning) && (
        <div className="pl-4 mb-6">
          <p className="text-[#a3aac4] text-base leading-relaxed border-l-4 border-[#40485d]/30 pl-4 py-1 italic">
            &ldquo;{reasoning ?? ticket.description}&rdquo;
          </p>
        </div>
      )}

      <div className="pl-4 flex items-center justify-between border-t-2 border-black/10 pt-6">
        <div className="flex items-center gap-4">
          {ticket.suggested_assignee_name && (
            <>
              <div
                className="w-10 h-10 border-2 border-black bg-[#bd9dff] flex items-center justify-center font-black text-[#3c0089] text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                title={ticket.suggested_assignee_name}
              >
                {initials(ticket.suggested_assignee_name)}
              </div>
              <div>
                <p className="text-xs font-bold text-[#6d758c] uppercase tracking-widest">
                  Suggested Assignee
                </p>
                <p className="text-sm font-black text-white">{ticket.suggested_assignee_name}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-4">
          <button
            onClick={onReject}
            disabled={isApproving || isRejecting}
            className="px-4 py-2 text-[#a3aac4] font-bold border-2 border-[#40485d]/30 hover:border-[#a3aac4] hover:text-white transition-colors disabled:opacity-40"
          >
            Dismiss
          </button>
          <button
            onClick={onApprove}
            disabled={isApproving || isRejecting}
            className="px-6 py-2 bg-[#bd9dff] text-[#3c0089] border-2 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:-translate-y-[2px] transition-transform active:translate-x-0 active:translate-y-0 disabled:opacity-40"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
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
    <article
      className={`relative bg-[#0f1930] border-4 border-black p-6 glass-sheen opacity-90 ${meta.shadow}`}
    >
      <div className={`absolute top-0 left-0 w-1.5 h-full ${meta.stripe}`} />

      <div className="flex justify-between items-start mb-4 pl-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`${meta.labelClass} font-black text-xs uppercase tracking-tighter`}
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {meta.label}
            </span>
            <span className="text-[#40485d] text-xs">•</span>
            <span className="font-black text-[#a3aac4] text-sm" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              {channelDisplay}
            </span>
            {(decision.story_points || decision.estimated_hours) && (
              <>
                <span className="text-[#40485d] text-xs">•</span>
                <span className="font-bold text-[#6d758c] text-xs uppercase tracking-widest mt-0.5">
                  {decision.story_points ? `${decision.story_points} pts` : ''}
                  {decision.story_points && decision.estimated_hours ? ' · ' : ''}
                  {decision.estimated_hours ? `~${decision.estimated_hours}h` : ''}
                </span>
              </>
            )}
          </div>
          <h3
            className="text-xl font-black leading-tight text-white tracking-tight"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {decision.action === 'auto_assigned' && decision.assignee_name
              ? `Assigned to ${decision.assignee_name}`
              : decision.jira_ticket_id ?? 'Decision recorded'}
          </h3>
        </div>
        <span className="text-sm font-mono text-[#6d758c] font-bold shrink-0 ml-4">
          {formatDistanceToNow(new Date(decision.created_at), { addSuffix: true })}
        </span>
      </div>

      {decision.reasoning && (
        <div className="pl-4 mb-6">
          <p className="text-[#a3aac4] text-base leading-relaxed border-l-4 border-[#40485d]/30 pl-4 py-1 italic">
            &ldquo;{decision.reasoning}&rdquo;
          </p>
        </div>
      )}

      <div className="pl-4 flex items-center justify-between border-t-2 border-black/10 pt-6">
        <div className="flex items-center gap-4">
          {decision.story_points && (
            <span className="text-xs font-bold text-[#6d758c] uppercase">
              {decision.story_points} pts · {(decision.confidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
        {decision.jira_ticket_id && (
          <span className="text-xs font-mono font-bold text-[#bd9dff]">
            {decision.jira_ticket_id}
          </span>
        )}
      </div>
    </article>
  )
}

// ─── right sidebar widgets ───────────────────────────────────────────────────

function SystemLoadWidget({ count, total }: { count: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (count / total) * 100) : count > 0 ? 60 : 5
  return (
    <div className="border-4 border-black bg-[#192540] p-5 shadow-[4px_4px_0px_0px_#bd9dff] relative">
      <div className="absolute -top-3 left-4 px-2 bg-[#bd9dff] text-[#3c0089] border-2 border-black text-[10px] font-black uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-space-grotesk)' }}>
        System Load
      </div>
      <div className="flex justify-between items-end">
        <div>
          <p className="font-black text-4xl text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{count}</p>
          <p className="text-xs font-bold text-[#bd9dff] uppercase tracking-widest mt-1"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Active Threads
          </p>
        </div>
        <Bot className="text-[#bd9dff] h-10 w-10" />
      </div>
      <div className="mt-4 h-2 bg-[#060e20] border-2 border-black w-full overflow-hidden">
        <div className="h-full bg-[#bd9dff] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function QueueHealthWidget({ pct }: { pct: number }) {
  return (
    <div className="border-4 border-black bg-[#192540] p-5 shadow-[4px_4px_0px_0px_#ff6e84] relative">
      <div className="absolute -top-3 left-4 px-2 bg-[#ff6e84] text-[#490013] border-2 border-black text-[10px] font-black uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-space-grotesk)' }}>
        Performance
      </div>
      <div className="flex justify-between items-end">
        <div>
          <p className="font-black text-4xl text-white" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {pct > 0 ? `${pct}%` : '—'}
          </p>
          <p className="text-xs font-bold text-[#ff6e84] uppercase tracking-widest mt-1"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            Avg Confidence
          </p>
        </div>
        <Zap className="text-[#ff6e84] h-10 w-10" />
      </div>
      <div className="mt-4 h-2 bg-[#060e20] border-2 border-black w-full overflow-hidden">
        <div className="h-full bg-[#ff6e84] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ActivityWidget({
  autoAssigned,
  flagged,
  dismissed,
}: {
  autoAssigned: number
  flagged: number
  dismissed: number
}) {
  return (
    <div className="flex-1 border-4 border-black bg-black/20 p-5 flex flex-col">
      <h4
        className="font-black text-white text-lg mb-4 border-b-2 border-black pb-2"
        style={{ fontFamily: 'var(--font-space-grotesk)' }}
      >
        Today&apos;s Activity
      </h4>
      <ul className="space-y-4">
        <li className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-bold text-[#dee5ff]">Auto-assigned</span>
          </div>
          <span className="text-sm font-mono font-black text-green-400">{autoAssigned}</span>
        </li>
        <li className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#bd9dff]" />
            <span className="text-sm font-bold text-[#dee5ff]">Flagged for review</span>
          </div>
          <span className="text-sm font-mono font-black text-[#bd9dff]">{flagged}</span>
        </li>
        <li className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#6d758c]" />
            <span className="text-sm font-bold text-[#dee5ff]">Dismissed</span>
          </div>
          <span className="text-sm font-mono font-black text-[#a3aac4]">{dismissed}</span>
        </li>
      </ul>
      <div className="mt-auto p-4 border-2 border-dashed border-[#40485d]/30 flex flex-col items-center text-center">
        <RefreshCw className="text-[#a3aac4] h-5 w-5 mb-2" />
        <p className="text-[10px] font-bold text-[#a3aac4] uppercase" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          Live · Auto-refreshes
        </p>
      </div>
    </div>
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

  const decisions = decisionsData?.decisions ?? []
  const draftTickets = ticketsData?.tickets.filter((t) => t.status === 'draft') ?? []

  const getReasoningForTicket = (ticketId: string) =>
    decisions.find((d: AgentDecision) => d.ticket_id === ticketId)?.reasoning

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

  const handleRefresh = () => {
    mutateStatus()
    mutateDecisions()
    mutateSummary()
    mutateTickets()
  }

  // Decisions that aren't draft tickets (already actioned)
  const completedDecisions = decisions.filter(
    (d: AgentDecision) => d.action !== 'flagged_for_review' || !draftTickets.find((t) => t.id === d.ticket_id)
  )

  const confidencePct = agentStatus?.avg_confidence_today
    ? Math.round(agentStatus.avg_confidence_today * 100)
    : 0

  const activeCount = draftTickets.length + (agentStatus?.auto_assigned_today ?? 0)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky top header */}
      <header className="sticky top-0 z-40 border-b-4 border-black bg-slate-900/80 backdrop-blur-md flex justify-between items-center px-8 py-4 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-4">
          <span
            className="text-3xl font-black italic tracking-tighter text-slate-50"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Live Feed
          </span>
          <div
            className="px-2 py-1 bg-[#ff6e84] text-[#490013] text-[10px] font-black uppercase tracking-widest border-2 border-black"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Realtime
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div
            className="hidden md:flex gap-4 font-black text-lg"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            <span className="text-violet-400">Overview</span>
            {agentStatus && (
              <span className="text-slate-400 text-base font-medium">
                {agentStatus.monitored_channels} channels · {agentStatus.decisions_today} decisions today
              </span>
            )}
          </div>
          <button
            onClick={handleRefresh}
            className="bg-[#bd9dff] text-[#3c0089] px-6 py-2 border-2 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-95 duration-100"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Refresh Feed
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 bg-[#060e20]">
        {/* Feed */}
        <section className="flex-1 p-8 space-y-8">
          {draftTickets.length === 0 && completedDecisions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <Bot className="h-12 w-12 text-[#40485d]" />
              <p
                className="text-xl font-black text-[#a3aac4]"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                No activity yet
              </p>
              <p className="text-sm text-[#6d758c]">
                The agent will post here as it processes Slack threads.
              </p>
            </div>
          )}

          {/* Draft tickets needing approval */}
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

          {/* Completed decisions */}
          {completedDecisions.slice(0, 20).map((decision: AgentDecision) => (
            <DecisionCard key={decision.id} decision={decision} />
          ))}
        </section>

        {/* Right sidebar widgets */}
        <aside className="w-80 shrink-0 border-l-4 border-black bg-slate-900 p-6 flex flex-col gap-8">
          <SystemLoadWidget
            count={draftTickets.length}
            total={Math.max(draftTickets.length, 10)}
          />
          <QueueHealthWidget pct={confidencePct} />
          <ActivityWidget
            autoAssigned={agentStatus?.auto_assigned_today ?? 0}
            flagged={agentStatus?.flagged_for_review_today ?? 0}
            dismissed={agentStatus?.dismissed_today ?? 0}
          />

          {/* Sprint health link */}
          {summary?.current_sprint && (
            <div className="border-4 border-black bg-[#192540] p-5">
              <p
                className="text-xs font-black text-[#a3aac4] uppercase tracking-widest mb-2"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Sprint Health
              </p>
              <p
                className="font-black text-3xl text-white"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {summary.current_sprint.adhoc_percentage.toFixed(1)}%
              </p>
              <p className="text-xs text-[#a3aac4] mt-1">adhoc this sprint</p>
              <a
                href="/analytics"
                className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-[#bd9dff] hover:underline"
              >
                Full analytics <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* All clear when no drafts */}
          {draftTickets.length === 0 && (
            <div className="border-4 border-black bg-[#192540] p-5 flex items-center gap-3">
              <Check className="h-5 w-5 text-green-400 shrink-0" />
              <p className="text-xs font-bold text-[#a3aac4]">
                No pending approvals — fully autonomous
              </p>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}
