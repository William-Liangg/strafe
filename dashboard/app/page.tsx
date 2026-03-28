'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Bot, Eye, XCircle, ArrowRight, ExternalLink, Check, X } from 'lucide-react'
import { useAgentDecisions, useAgentStatus, useSummary, useTickets } from '@/lib/hooks'
import { ErrorState } from '@/components/ErrorState'
import { StatusBadge, PriorityBadge } from '@/components/TicketBadge'
import { TicketDetailPanel } from '@/components/TicketDetailPanel'
import type { Ticket, AgentDecision } from '@/lib/types'
import { approveTicket, rejectTicket } from '@/lib/api'

function AgentStatusBadge({ status }: { status: 'active' | 'idle' | 'offline' }) {
  const colors = {
    active: 'bg-green-500',
    idle: 'bg-yellow-500',
    offline: 'bg-red-500',
  }

  return (
    <span className={`inline-block w-3 h-3 rounded-full ${colors[status]} animate-pulse`} />
  )
}

function DecisionIcon({ action }: { action: string }) {
  switch (action) {
    case 'auto_assigned':
      return <Bot className="h-5 w-5 text-green-600" />
    case 'flagged_for_review':
      return <Eye className="h-5 w-5 text-amber-600" />
    case 'dismissed':
      return <XCircle className="h-5 w-5 text-gray-400" />
    default:
      return <Bot className="h-5 w-5 text-gray-400" />
  }
}

function getActionLabel(action: string) {
  switch (action) {
    case 'auto_assigned':
      return 'Auto-assigned'
    case 'flagged_for_review':
      return 'Sent for review'
    case 'dismissed':
      return 'Dismissed'
    default:
      return action
  }
}

function getActionColor(action: string) {
  switch (action) {
    case 'auto_assigned':
      return 'border-l-green-500 bg-green-50/50'
    case 'flagged_for_review':
      return 'border-l-amber-500 bg-amber-50/50'
    case 'dismissed':
      return 'border-l-gray-300 bg-gray-50/50'
    default:
      return 'border-l-gray-300'
  }
}

function DecisionCard({ decision }: { decision: AgentDecision }) {
  return (
    <div
      className={`border-l-4 rounded-r-lg p-4 mb-3 transition-all duration-300 ease-in-out ${getActionColor(decision.action)}`}
    >
      <div className="flex items-start gap-3">
        <DecisionIcon action={decision.action} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${
              decision.action === 'auto_assigned' ? 'text-green-700' :
              decision.action === 'flagged_for_review' ? 'text-amber-700' :
              'text-gray-600'
            }`}>
              {getActionLabel(decision.action)}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">#{decision.channel_name.replace('#', '')}</span>
          </div>

          {decision.action === 'auto_assigned' && (
            <div className="mb-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {decision.jira_ticket_id && (
                  <a
                    href={`https://yourworkspace.atlassian.net/browse/${decision.jira_ticket_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline mr-2"
                  >
                    {decision.jira_ticket_id}
                  </a>
                )}
                → {decision.assignee_name}
              </p>
              {decision.story_points && (
                <span className="text-xs text-gray-500">
                  {decision.story_points} pts {decision.estimated_hours ? `· ~${decision.estimated_hours} hours ` : ''}· {(decision.confidence * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
          )}

          {decision.action === 'flagged_for_review' && (
            <div className="mb-2">
              <p className="text-sm text-gray-700">
                Awaiting manager approval
              </p>
              {decision.story_points && (
                <span className="text-xs text-gray-500">
                  {decision.story_points} pts {decision.estimated_hours ? `· ~${decision.estimated_hours} hours ` : ''}· {(decision.confidence * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500 leading-relaxed">
            {decision.reasoning}
          </p>

          <p className="text-xs text-gray-400 mt-2">
            {formatDistanceToNow(new Date(decision.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  )
}

function PendingApprovalCard({
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
  return (
    <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4 mb-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {ticket.title}
          </p>
          {reasoning && (
            <p className="text-xs text-gray-600 mb-2">
              {reasoning}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">
              {ticket.story_points} pts {ticket.estimated_hours ? `· ~${ticket.estimated_hours} hours` : ''}
            </span>
            <PriorityBadge priority={ticket.priority} />
            {ticket.suggested_assignee_name && (
              <span className="text-gray-500">
                → {ticket.suggested_assignee_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={isApproving || isRejecting}
            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            title="Approve"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onReject}
            disabled={isApproving || isRejecting}
            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50"
            title="Reject"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgentPage() {
  const { data: agentStatus, error: statusError, mutate: mutateStatus } = useAgentStatus()
  const { data: decisionsData, error: decisionsError, mutate: mutateDecisions } = useAgentDecisions(undefined, 50)
  const { data: summary, error: summaryError, mutate: mutateSummary } = useSummary()
  const { data: ticketsData, error: ticketsError, mutate: mutateTickets } = useTickets()

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const isLoading = !agentStatus && !statusError
  const decisions = decisionsData?.decisions ?? []
  const draftTickets = ticketsData?.tickets.filter(t => t.status === 'draft') ?? []

  // Find reasoning for draft tickets from decisions
  const getReasoningForTicket = (ticketId: string) => {
    const decision = decisions.find((d: any) => d.ticket_id === ticketId)
    return decision?.reasoning
  }

  const handleApprove = async (ticket: Ticket) => {
    setApprovingId(ticket.id)
    try {
      await approveTicket(ticket.id)
      mutateTickets()
      mutateDecisions()
      mutateSummary()
    } catch (error) {
      console.error('Failed to approve ticket:', error)
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
    } catch (error) {
      console.error('Failed to reject ticket:', error)
    } finally {
      setRejectingId(null)
    }
  }

  const handleTicketUpdate = () => {
    mutateTickets()
    mutateDecisions()
    mutateSummary()
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          {isLoading ? (
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          ) : statusError ? (
            <h1 className="text-2xl font-bold text-gray-900">Strafe Agent</h1>
          ) : (
            <>
              <AgentStatusBadge status={agentStatus?.agent_status ?? 'offline'} />
              <h1 className="text-2xl font-bold text-gray-900">
                Strafe is {agentStatus?.agent_status ?? 'offline'}
              </h1>
            </>
          )}
        </div>
        {!isLoading && !statusError && agentStatus && (
          <p className="text-gray-600">
            Monitoring {agentStatus.monitored_channels} channels ·{' '}
            {agentStatus.decisions_today} decision{agentStatus.decisions_today !== 1 ? 's' : ''} today ·{' '}
            {agentStatus.active_sprint && (
              <>
                {agentStatus.active_sprint} is{' '}
                <span className={agentStatus.sprint_adhoc_percentage && agentStatus.sprint_adhoc_percentage > 30 ? 'text-red-600 font-medium' : ''}>
                  {agentStatus.sprint_adhoc_percentage?.toFixed(1)}% adhoc
                </span>
              </>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Agent Activity Feed - Left column (3/5 width) */}
        <div className="col-span-3 space-y-4">
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <h2 className="text-sm font-medium text-gray-700 mb-4">
              Agent decisions
            </h2>
            {decisionsError ? (
              <ErrorState onRetry={() => mutateDecisions()} />
            ) : decisions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No agent decisions yet. The agent will appear here as it processes Slack threads.
              </div>
            ) : (
              <div className="space-y-0">
                {decisions.map((decision: AgentDecision) => (
                  <DecisionCard key={decision.id} decision={decision} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar (2/5 width) */}
        <div className="col-span-2 space-y-6">
          {/* Sprint Health Card */}
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <h2 className="text-sm font-medium text-gray-700 mb-4">
              Sprint health
            </h2>
            {summaryError ? (
              <ErrorState onRetry={() => mutateSummary()} />
            ) : !summary ? (
              <div className="animate-pulse space-y-3">
                <div className="h-12 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-200 rounded w-32" />
              </div>
            ) : summary.current_sprint ? (
              <div>
                <div className="text-4xl font-bold text-gray-900 mb-1">
                  {summary.current_sprint.adhoc_percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500 mb-4">
                  adhoc this sprint
                </div>

                {/* Trend mini sparkline */}
                {summary.trend.length > 0 && (
                  <div className="flex items-end gap-1 h-8 mb-4">
                    {summary.trend.slice(-5).map((item, i) => (
                      <div
                        key={item.sprint_id}
                        className="flex-1 bg-[#E2534A] rounded-t transition-all"
                        style={{
                          height: `${Math.max(10, (item.adhoc_percentage / 50) * 100)}%`,
                          opacity: 0.3 + (i / 5) * 0.7,
                        }}
                        title={`${item.sprint_name}: ${item.adhoc_percentage}%`}
                      />
                    ))}
                  </div>
                )}

                {summary.current_sprint.top_source_channel && (
                  <div className="text-sm">
                    <span className="text-gray-500">Top source:</span>{' '}
                    <span className="font-medium text-gray-900">
                      {summary.current_sprint.top_source_channel}
                    </span>
                  </div>
                )}

                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-1 mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View full analytics <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="text-gray-500">No active sprint</div>
            )}
          </div>

          {/* Pending Approvals */}
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <h2 className="text-sm font-medium text-gray-700 mb-4">
              Needs your attention
            </h2>
            {ticketsError ? (
              <ErrorState onRetry={() => mutateTickets()} />
            ) : draftTickets.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="text-sm">
                  Strafe is fully autonomous right now — no pending approvals
                </span>
              </div>
            ) : (
              <div className="space-y-0">
                {draftTickets.slice(0, 5).map((ticket) => (
                  <PendingApprovalCard
                    key={ticket.id}
                    ticket={ticket}
                    reasoning={getReasoningForTicket(ticket.id)}
                    onApprove={() => handleApprove(ticket)}
                    onReject={() => handleReject(ticket)}
                    isApproving={approvingId === ticket.id}
                    isRejecting={rejectingId === ticket.id}
                  />
                ))}
                {draftTickets.length > 5 && (
                  <Link
                    href="/tickets?status=draft"
                    className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View all {draftTickets.length} pending <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Today's Stats */}
          {agentStatus && !statusError && (
            <div className="bg-white rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-medium text-gray-700 mb-4">
                Today&apos;s activity
              </h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {agentStatus.auto_assigned_today}
                  </div>
                  <div className="text-xs text-gray-500">Auto-assigned</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">
                    {agentStatus.flagged_for_review_today}
                  </div>
                  <div className="text-xs text-gray-500">For review</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-400">
                    {agentStatus.dismissed_today}
                  </div>
                  <div className="text-xs text-gray-500">Dismissed</div>
                </div>
              </div>
              {agentStatus.avg_confidence_today > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <div className="text-sm text-gray-500">
                    Avg confidence: <span className="font-medium text-gray-900">{(agentStatus.avg_confidence_today * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
