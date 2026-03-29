'use client'

import { useState } from 'react'
import { X, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { marked } from 'marked'
import type { Ticket } from '@/lib/types'
import { approveTicket, rejectTicket } from '@/lib/api'

interface TicketDetailPanelProps {
  ticket: Ticket
  onClose: () => void
  onUpdate?: (ticket: Ticket) => void
}

// ─── helpers ────────────────────────────────────────────────────────────────

function priorityLabel(p: Ticket['priority']) {
  return p.toUpperCase()
}

function priorityColor(p: Ticket['priority']) {
  if (p === 'critical' || p === 'high') return 'text-[#9f403d]'
  if (p === 'medium') return 'text-[#a07842]'
  return 'text-[#757d6b]'
}

function priorityPip(p: Ticket['priority']) {
  if (p === 'critical' || p === 'high') return 'bg-[#9f403d]'
  if (p === 'medium') return 'bg-[#a07842]'
  return 'bg-[#b8c4a8]'
}

function statusStyle(status: Ticket['status']) {
  switch (status) {
    case 'draft':
      return { pip: 'bg-[#5f5e5e]', text: 'text-[#5f5e5e]', bg: 'bg-[#f2f5e8]', label: 'DRAFT' }
    case 'created':
      return { pip: 'bg-[#3a6b4a]', text: 'text-[#3a6b4a]', bg: 'bg-[#f2f5e8]', label: 'APPROVED' }
    case 'rejected':
      return { pip: 'bg-[#9f403d]', text: 'text-[#9f403d]', bg: 'bg-[#f2f5e8]', label: 'REJECTED' }
    default:
      return { pip: 'bg-[#b8c4a8]', text: 'text-[#757d6b]', bg: 'bg-[#f2f5e8]', label: status.toUpperCase() }
  }
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

const AVAIL_DAYS = [
  { label: 'Mon', busy: true },
  { label: 'Tue', busy: false },
  { label: 'Wed', busy: true },
  { label: 'Thu', busy: false },
  { label: 'Fri', busy: true },
]

// ─── panel ───────────────────────────────────────────────────────────────────

export function TicketDetailPanel({ ticket, onClose, onUpdate }: TicketDetailPanelProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [localTicket, setLocalTicket] = useState(ticket)

  const isDraft = localTicket.status === 'draft'
  const isCreated = localTicket.status === 'created'
  const isRejected = localTicket.status === 'rejected'

  const handleApprove = async () => {
    if (!showConfirm) { setShowConfirm(true); return }
    setIsApproving(true)
    setError(null)
    try {
      const result = await approveTicket(ticket.id)
      const updated = {
        ...localTicket,
        status: 'created' as const,
        jira_ticket_id: result.jira_ticket_id,
        jira_ticket_url: result.jira_ticket_url,
      }
      setLocalTicket(updated)
      onUpdate?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setIsApproving(false)
      setShowConfirm(false)
    }
  }

  const handleReject = async () => {
    setIsRejecting(true)
    setError(null)
    try {
      const updated = await rejectTicket(ticket.id, rejectReason || undefined)
      setLocalTicket(updated)
      setShowRejectForm(false)
      onUpdate?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setIsRejecting(false)
    }
  }

  const ss = statusStyle(localTicket.status)
  const descriptionHtml = marked(localTicket.description || '*No description provided.*')
  const channel = localTicket.source_channel_name
    ? `#${localTicket.source_channel_name.replace('#', '')}`
    : '#unknown'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-[#2d3526]/20 z-40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[480px] z-50 bg-white shadow-[-32px_0px_64px_rgba(45,53,38,0.08)] flex flex-col overflow-hidden">

        {/* Panel header */}
        <div className="p-6 border-b border-[#b8c4a8]/20 bg-[#f9faf0]">
          <div className="flex justify-between items-start mb-4">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold ${ss.bg} ${ss.text}`}
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${ss.pip}`} />
              {ss.label}
            </span>
            <button onClick={onClose} className="text-[#b8c4a8] hover:text-[#2d3526] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <h3
            className="text-xl font-bold leading-tight text-[#2d3526] mb-4"
            style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}
          >
            {localTicket.title}
          </h3>

          <div className="flex flex-wrap gap-2">
            <span
              className="px-2.5 py-1 bg-[#ebf0e0] text-xs font-medium text-[#757d6b] rounded-xl"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {localTicket.origin_type} ticket
            </span>
            {localTicket.labels.map((label) => (
              <span
                key={label}
                className="px-2.5 py-1 bg-[#f2f5e8] text-xs font-medium text-[#5f5e5e] rounded-xl"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                {label}
              </span>
            ))}
            <span
              className="px-2.5 py-1 bg-[#f2f5e8] text-xs font-medium text-[#757d6b] rounded-xl"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {channel}
            </span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-7 pb-[220px]">
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-[#f9faf0] rounded-2xl">
              <div className="w-1.5 h-1.5 rounded-full bg-[#9f403d] shrink-0" />
              <p className="text-[#9f403d] text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#f9faf0] rounded-2xl">
              <p
                className="text-[10px] font-semibold text-[#757d6b] uppercase tracking-widest mb-2"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Priority
              </p>
              <div className={`flex items-center gap-1.5 font-semibold text-base ${priorityColor(localTicket.priority)}`}
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${priorityPip(localTicket.priority)}`} />
                {priorityLabel(localTicket.priority)}
              </div>
            </div>
            <div className="p-4 bg-[#f9faf0] rounded-2xl">
              <p
                className="text-[10px] font-semibold text-[#757d6b] uppercase tracking-widest mb-2"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Story Points
              </p>
              <div
                className="text-2xl font-bold text-[#2d3526]"
                style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}
              >
                {localTicket.story_points}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4
              className="text-[10px] font-semibold text-[#757d6b] uppercase tracking-widest mb-3"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Description
            </h4>
            <div
              className="text-[#757d6b] text-sm leading-relaxed [&_code]:bg-[#f2f5e8] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:font-mono [&_code]:text-[#5f5e5e] [&_p]:mb-2"
              dangerouslySetInnerHTML={{ __html: descriptionHtml as string }}
            />
          </div>

          {/* Assignee */}
          {localTicket.suggested_assignee_name && (
            <div>
              <h4
                className="text-[10px] font-semibold text-[#757d6b] uppercase tracking-widest mb-4"
                style={{ fontFamily: 'var(--font-manrope)' }}
              >
                Smart Assignee Match
              </h4>

              <div className="bg-[#f9faf0] rounded-2xl p-5">
                <div className="flex gap-4 mb-5">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-[#ebf0e0] flex items-center justify-center font-semibold text-[#2d3526] text-lg">
                      {initials(localTicket.suggested_assignee_name)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#3a6b4a] rounded-full border-2 border-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5
                      className="font-bold text-[#2d3526] text-base"
                      style={{ fontFamily: 'var(--font-manrope)' }}
                    >
                      {localTicket.suggested_assignee_name}
                    </h5>
                    {localTicket.assignee_reason && (
                      <p className="text-[#757d6b] text-xs mt-1 italic leading-relaxed">
                        {localTicket.assignee_reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Availability bars */}
                <div>
                  <p
                    className="text-[10px] font-semibold text-[#757d6b] uppercase tracking-widest mb-2"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    Weekly Availability (Mon–Fri)
                  </p>
                  <div className="flex h-2 gap-1">
                    {AVAIL_DAYS.map(({ label, busy }) => (
                      <div
                        key={label}
                        className={`flex-1 rounded-full ${busy ? 'bg-[#9f403d]/20' : 'bg-[#3a6b4a]/30'}`}
                        title={label}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 bg-[#3a6b4a]/5 px-3 py-2 rounded-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3a6b4a] shrink-0" />
                    <span
                      className="text-xs text-[#3a6b4a] font-semibold"
                      style={{ fontFamily: 'var(--font-manrope)' }}
                    >
                      Best window: Tuesday 2–6 PM
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Jira link */}
          {isCreated && localTicket.jira_ticket_id && localTicket.jira_ticket_id !== 'JIRA_ERROR' && (
            <a
              href={localTicket.jira_ticket_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#f2f5e8] text-[#5f5e5e] text-sm font-semibold rounded-2xl hover:bg-[#ebf0e0] transition-colors"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View {localTicket.jira_ticket_id} in Jira
            </a>
          )}

          {/* Rejection reason */}
          {isRejected && localTicket.rejection_reason && (
            <div className="p-4 bg-[#f9faf0] rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#9f403d]" />
                <p
                  className="text-[10px] font-semibold text-[#9f403d] uppercase tracking-widest"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  Rejection Reason
                </p>
              </div>
              <p className="text-sm text-[#757d6b]">{localTicket.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="absolute bottom-0 left-0 w-full bg-white border-t border-[#b8c4a8]/20 p-6 shadow-[0px_-8px_24px_rgba(45,53,38,0.06)]">
          {/* APPROVED STATE */}
          {isCreated && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#3a6b4a] shrink-0" />
                <div>
                  <p
                    className="text-[#3a6b4a] text-[10px] font-semibold tracking-widest uppercase"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    Executed
                  </p>
                  <h4
                    className="font-bold text-[#2d3526] text-base"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    Deployment Success
                  </h4>
                </div>
              </div>
              <div className="space-y-2.5 mb-5 bg-[#f9faf0] rounded-2xl p-4">
                <div className="flex items-center gap-3 text-sm text-[#2d3526]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3a6b4a] shrink-0" />
                  <span>
                    Jira ticket created{' '}
                    {localTicket.jira_ticket_id && localTicket.jira_ticket_id !== 'JIRA_ERROR' && (
                      <span className="font-mono text-[#5f5e5e]">{localTicket.jira_ticket_id}</span>
                    )}
                  </span>
                </div>
                {localTicket.suggested_assignee_name && (
                  <div className="flex items-center gap-3 text-sm text-[#2d3526]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3a6b4a] shrink-0" />
                    <span>
                      Assigned to{' '}
                      <span className="font-semibold">{localTicket.suggested_assignee_name}</span>
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-[#2d3526]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3a6b4a] shrink-0" />
                  <span>
                    Slack DM dispatched via{' '}
                    <span className="font-mono text-[#757d6b]">#strafe-bot</span>
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 text-white font-semibold rounded-2xl transition-opacity hover:opacity-90"
                style={{ fontFamily: 'var(--font-manrope)', background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' }}
              >
                Done
              </button>
            </>
          )}

          {/* REJECTED STATE */}
          {isRejected && (
            <button
              onClick={onClose}
              className="w-full py-3 bg-[#f2f5e8] text-[#757d6b] font-semibold rounded-2xl hover:bg-[#ebf0e0] transition-colors"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Close
            </button>
          )}

          {/* DRAFT STATE */}
          {isDraft && (
            <>
              {showConfirm ? (
                <div className="space-y-4">
                  <p className="text-sm text-[#757d6b]">
                    This will create a Jira ticket
                    {localTicket.suggested_assignee_name && ` and notify ${localTicket.suggested_assignee_name}`}.
                    Continue?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="flex-1 py-3 text-white font-semibold rounded-2xl disabled:opacity-50 transition-opacity hover:opacity-90"
                      style={{ fontFamily: 'var(--font-manrope)', background: 'linear-gradient(180deg, #3a6b4a 0%, #2e5439 100%)' }}
                    >
                      {isApproving ? 'Creating…' : 'Yes, create ticket'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-6 py-3 bg-[#f2f5e8] text-[#757d6b] font-medium rounded-2xl hover:bg-[#ebf0e0] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : showRejectForm ? (
                <div className="space-y-4">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    rows={3}
                    className="w-full px-4 py-3 bg-[#f9faf0] rounded-2xl text-[#2d3526] placeholder-[#b8c4a8] text-sm focus:outline-none focus:ring-1 focus:ring-[#757d6b] resize-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleReject}
                      disabled={isRejecting}
                      className="flex-1 py-3 bg-[#9f403d] text-white font-semibold rounded-2xl disabled:opacity-50 transition-opacity hover:opacity-90"
                      style={{ fontFamily: 'var(--font-manrope)' }}
                    >
                      {isRejecting ? 'Rejecting…' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="px-6 py-3 bg-[#f2f5e8] text-[#757d6b] font-medium rounded-2xl hover:bg-[#ebf0e0] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    className="flex-1 py-3 text-white font-semibold rounded-2xl transition-opacity hover:opacity-90"
                    style={{ fontFamily: 'var(--font-manrope)', background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' }}
                  >
                    Approve → Jira
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="px-6 py-3 bg-[#f2f5e8] text-[#9f403d] font-semibold rounded-2xl hover:bg-[#9f403d]/10 transition-colors"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
