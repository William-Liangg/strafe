'use client'

import { useState } from 'react'
import { X, ExternalLink, Clock, Tag, User, Hash, Zap } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { marked } from 'marked'
import type { Ticket } from '@/lib/types'
import { StatusBadge, PriorityBadge, OriginBadge } from './TicketBadge'
import { formatTriggerMode } from '@/lib/utils'
import { approveTicket, rejectTicket } from '@/lib/api'

interface TicketDetailPanelProps {
  ticket: Ticket
  onClose: () => void
  onUpdate?: (ticket: Ticket) => void
}

export function TicketDetailPanel({
  ticket,
  onClose,
  onUpdate,
}: TicketDetailPanelProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [localTicket, setLocalTicket] = useState(ticket)

  const handleApprove = async () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    setIsApproving(true)
    setError(null)

    try {
      const result = await approveTicket(ticket.id)
      const updatedTicket = {
        ...localTicket,
        status: 'created' as const,
        jira_ticket_id: result.jira_ticket_id,
        jira_ticket_url: result.jira_ticket_url,
      }
      setLocalTicket(updatedTicket)
      setSuccessMessage(
        result.jira_ticket_id && result.jira_ticket_id !== 'JIRA_ERROR'
          ? `${result.jira_ticket_id} created in Jira`
          : result.message
      )
      onUpdate?.(updatedTicket)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve ticket')
    } finally {
      setIsApproving(false)
      setShowConfirm(false)
    }
  }

  const handleReject = async () => {
    setIsRejecting(true)
    setError(null)

    try {
      const updatedTicket = await rejectTicket(ticket.id, rejectReason || undefined)
      setLocalTicket(updatedTicket)
      setShowRejectForm(false)
      onUpdate?.(updatedTicket)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject ticket')
    } finally {
      setIsRejecting(false)
    }
  }

  const descriptionHtml = marked(localTicket.description || '')

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {localTicket.title}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <OriginBadge origin={localTicket.origin_type} />
              <span className="text-xs text-gray-500">
                {formatTriggerMode(localTicket.trigger_mode)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status and success/error messages */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-sm">{successMessage}</p>
              {localTicket.jira_ticket_url && (
                <a
                  href={localTicket.jira_ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-green-700 text-sm font-medium mt-2 hover:underline"
                >
                  View in Jira <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">
                Status
              </label>
              <div className="mt-1">
                <StatusBadge status={localTicket.status} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">
                Priority
              </label>
              <div className="mt-1">
                <PriorityBadge priority={localTicket.priority} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Zap className="h-3 w-3" /> Story Points
              </label>
              <p className="mt-1 text-sm font-medium">{localTicket.story_points}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Hash className="h-3 w-3" /> Source Channel
              </label>
              <p className="mt-1 text-sm font-medium">
                {localTicket.source_channel_name || 'N/A'}
              </p>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <User className="h-3 w-3" /> Assignee
              </label>
              <p className="mt-1 text-sm font-medium">
                {localTicket.suggested_assignee_name || 'Unassigned'}
              </p>
              {localTicket.assignee_reason && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {localTicket.assignee_reason}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-3 w-3" /> Created
              </label>
              <p className="mt-1 text-sm">
                {formatDistanceToNow(new Date(localTicket.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
            {localTicket.labels.length > 0 && (
              <div className="col-span-2">
                <label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Labels
                </label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {localTicket.labels.map((label) => (
                    <span
                      key={label}
                      className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Description
            </label>
            <div
              className="mt-2 prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          </div>

          {/* Jira link */}
          {localTicket.jira_ticket_id &&
            localTicket.jira_ticket_id !== 'JIRA_ERROR' && (
              <div>
                <a
                  href={localTicket.jira_ticket_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  View {localTicket.jira_ticket_id} in Jira
                </a>
              </div>
            )}

          {/* Rejection reason */}
          {localTicket.status === 'rejected' && localTicket.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <label className="text-xs text-red-600 uppercase tracking-wide">
                Rejection Reason
              </label>
              <p className="mt-1 text-sm text-red-800">
                {localTicket.rejection_reason}
              </p>
            </div>
          )}

          {/* Actions (only for draft tickets) */}
          {localTicket.status === 'draft' && (
            <div className="pt-4 border-t border-gray-200 space-y-3">
              {showConfirm ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-3">
                    This will create a Jira ticket
                    {localTicket.suggested_assignee_name &&
                      ` and notify ${localTicket.suggested_assignee_name}`}
                    . Continue?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {isApproving ? 'Creating...' : 'Yes, create ticket'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : showRejectForm ? (
                <div className="space-y-3">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={isRejecting}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {isRejecting ? 'Rejecting...' : 'Confirm reject'}
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                  >
                    Approve ticket
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
