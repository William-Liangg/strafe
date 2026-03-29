'use client'

import { useState } from 'react'
import { X, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { marked } from 'marked'
import type { Ticket } from '@/lib/types'
import { approveTicket, rejectTicket, updateTicket } from '@/lib/api'
import { CURRENT_USER } from '@/lib/user'

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
  if (p === 'critical' || p === 'high') return 'text-[#ff6e84]'
  if (p === 'medium') return 'text-amber-400'
  return 'text-[#a3aac4]'
}

function statusBadgeStyle(status: Ticket['status']) {
  switch (status) {
    case 'draft':
      return 'bg-[#bd9dff] text-[#3c0089] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
    case 'created':
      return 'bg-green-500 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
    case 'rejected':
      return 'bg-[#ff6e84] text-[#490013] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
    default:
      return 'bg-[#192540] text-[#dee5ff] border-2 border-black'
  }
}

function statusLabel(status: Ticket['status']) {
  switch (status) {
    case 'draft': return 'DRAFT TICKET'
    case 'created': return 'APPROVED'
    case 'rejected': return 'REJECTED'
    default: return status.toUpperCase()
  }
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

// ─── availability bars (decorative) ─────────────────────────────────────────

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

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(ticket.title)
  const [editDescription, setEditDescription] = useState(ticket.description || '')
  const [editStoryPoints, setEditStoryPoints] = useState(ticket.story_points || 3)
  const [isSaving, setIsSaving] = useState(false)

  const isDraft = localTicket.status === 'draft'
  const isCreated = localTicket.status === 'created'
  const isRejected = localTicket.status === 'rejected'

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const updated = await updateTicket(ticket.id, {
        title: editTitle,
        description: editDescription,
        story_points: editStoryPoints,
      })
      setLocalTicket(updated)
      setIsEditing(false)
      onUpdate?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save edits')
    } finally {
      setIsSaving(false)
    }
  }

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

  const descriptionHtml = marked(localTicket.description || '*No description provided.*')
  const channel = localTicket.source_channel_name
    ? `#${localTicket.source_channel_name.replace('#', '')}`
    : '#unknown'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[480px] z-50 bg-[#060e20] shadow-[-8px_0px_0px_0px_rgba(0,0,0,1)] border-l-4 border-black flex flex-col overflow-hidden">
        {/* Glass sheen */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%)', backdropFilter: 'blur(12px)' }}
        />

        {/* Panel header */}
        <div className="relative z-10 p-6 border-b-4 border-black bg-[#192540]">
          <div className="flex justify-between items-start mb-4">
            <span
              className={`px-3 py-1 font-black text-xs ${statusBadgeStyle(localTicket.status)}`}
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {statusLabel(localTicket.status)}
            </span>
            <div className="flex items-center gap-4">
              {!isEditing && localTicket.suggested_assignee_name === CURRENT_USER.name && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-bold text-[#bd9dff] hover:underline uppercase tracking-widest"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Edit Ticket
                </button>
              )}
              <button
                onClick={onClose}
                className="text-[#a3aac4] hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-xl font-black leading-tight tracking-tight text-white mb-4 bg-black/40 border-2 border-[#bd9dff] p-2 focus:outline-none"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            />
          ) : (
            <h3
              className="text-xl font-black leading-tight tracking-tight text-white mb-4"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {localTicket.title}
            </h3>
          )}

          <div className="flex flex-wrap gap-2">
            <span
              className="px-2 py-1 bg-[#4f319c] border border-black text-xs font-bold uppercase text-[#d7c8ff]"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {localTicket.origin_type} ticket
            </span>
            {localTicket.labels.map((label) => (
              <span
                key={label}
                className="px-2 py-1 border-2 border-[#bd9dff] text-[#bd9dff] text-xs font-bold uppercase"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {label}
              </span>
            ))}
            <span
              className="px-2 py-1 border-2 border-[#40485d] text-[#a3aac4] text-xs font-bold uppercase"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {channel}
            </span>
          </div>

          {localTicket.related_ticket_id && (
            <div className="mt-4 flex items-center">
              <span
                className="px-3 py-1 bg-[#192540] border-2 border-dashed border-[#bd9dff] text-[#bd9dff] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-help"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
                title={`Related Ticket ID: ${localTicket.related_ticket_id}`}
              >
                ⚯ {localTicket.relation_type?.replace('_', ' ') || 'RELATED'}
              </span>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-8 pb-[220px]">
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-3 p-3 bg-[#ff6e84]/10 border-2 border-[#ff6e84]">
              <AlertTriangle className="h-4 w-4 text-[#ff6e84] shrink-0" />
              <p className="text-[#ff6e84] text-sm font-bold">{error}</p>
            </div>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-[#0f1930] border-2 border-black">
              <p
                className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-1"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Priority
              </p>
              <div className={`flex items-center gap-1 font-black italic text-lg ${priorityColor(localTicket.priority)}`}
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                <AlertTriangle className="h-4 w-4" />
                {priorityLabel(localTicket.priority)}
              </div>
            </div>
            <div className="p-4 bg-[#0f1930] border-2 border-black">
              <p
                className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-1"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Story Points
              </p>
              {isEditing ? (
                <select
                  value={editStoryPoints}
                  onChange={(e) => setEditStoryPoints(Number(e.target.value))}
                  className="w-full bg-black/40 border-2 border-[#bd9dff] p-1 text-white font-black outline-none"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {[1, 2, 3, 5, 8].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <div
                  className="text-2xl font-black text-white"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {localTicket.story_points}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <h4
              className="text-[10px] font-black text-[#bd9dff] uppercase tracking-widest mb-3 flex items-center gap-2"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              <span className="w-1 h-3 bg-[#bd9dff] inline-block" />
              Description
            </h4>
            {isEditing ? (
               <textarea
                 value={editDescription}
                 onChange={(e) => setEditDescription(e.target.value)}
                 rows={10}
                 className="w-full bg-[#0f1930] border-2 border-[#bd9dff] p-3 text-[#dee5ff] text-sm focus:outline-none resize-none font-mono"
               />
            ) : (
              <div
                className="text-[#a3aac4] text-sm leading-relaxed prose-invert [&_code]:bg-black/40 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[#a88cfb] [&_p]:mb-2"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            )}
          </div>

          {/* Assignee */}
          {localTicket.suggested_assignee_name && (
            <div>
              <h4
                className="text-[10px] font-black text-[#bd9dff] uppercase tracking-widest mb-4 flex items-center gap-2"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                <span className="w-1 h-3 bg-[#bd9dff] inline-block" />
                Smart Assignee Match
              </h4>

              <div className="border-2 border-black bg-[#0f1930] p-4 relative overflow-hidden">
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 border-4 border-black bg-[#bd9dff] flex items-center justify-center font-black text-[#3c0089] text-xl">
                      {initials(localTicket.suggested_assignee_name)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-black rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h5
                        className="font-black text-white text-lg"
                        style={{ fontFamily: 'var(--font-space-grotesk)' }}
                      >
                        {localTicket.suggested_assignee_name}
                      </h5>
                    </div>
                    {localTicket.assignee_reason && (
                      <p className="text-[#6d758c] text-xs mt-1 italic line-clamp-2">
                        {localTicket.assignee_reason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Availability bars */}
                <div className="mt-6">
                  <p
                    className="text-[10px] font-bold text-[#40485d] mb-2"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    Weekly Availability (Mon–Fri)
                  </p>
                  <div className="flex h-3 gap-1">
                    {AVAIL_DAYS.map(({ label, busy }) => (
                      <div
                        key={label}
                        className={`flex-1 border ${busy ? 'bg-red-500/30 border-black/20' : 'bg-green-500/60 border-black'}`}
                        title={label}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                    <span
                      className="text-xs text-green-400 font-bold"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      Best window: Tuesday 2–6 PM
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Jira link (approved) */}
          {isCreated && localTicket.jira_ticket_id && localTicket.jira_ticket_id !== 'JIRA_ERROR' && (
            <a
              href={localTicket.jira_ticket_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f1930] border-2 border-[#bd9dff] text-[#bd9dff] text-sm font-bold hover:bg-[#bd9dff]/10 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View {localTicket.jira_ticket_id} in Jira
            </a>
          )}

          {/* Rejection reason */}
          {isRejected && localTicket.rejection_reason && (
            <div className="p-4 bg-[#ff6e84]/10 border-2 border-[#ff6e84]">
              <p
                className="text-[10px] font-black text-[#ff6e84] uppercase tracking-widest mb-1"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Rejection Reason
              </p>
              <p className="text-sm text-[#dee5ff]">{localTicket.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="absolute bottom-0 left-0 w-full bg-slate-900 border-t-4 border-black p-6 shadow-[0px_-8px_20px_rgba(0,0,0,0.5)] z-20">
          {/* ── APPROVED STATE ── */}
          {isCreated && !isEditing && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-500 flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p
                    className="text-green-400 text-[10px] font-black tracking-widest uppercase"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    Executed
                  </p>
                  <h4
                    className="font-black text-white text-lg tracking-tight"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    Deployment Success
                  </h4>
                </div>
              </div>
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-100">
                  <span>✅</span>
                  <span>
                    Jira ticket created{' '}
                    {localTicket.jira_ticket_id && localTicket.jira_ticket_id !== 'JIRA_ERROR' && (
                      <span className="font-mono text-[#b28cff] underline">{localTicket.jira_ticket_id}</span>
                    )}
                  </span>
                </div>
                {localTicket.suggested_assignee_name && (
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-100">
                    <span>📅</span>
                    <span>
                      Assigned to{' '}
                      <span className="text-[#b28cff] font-bold">{localTicket.suggested_assignee_name}</span>
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm font-medium text-slate-100">
                  <span>🔔</span>
                  <span>
                    Slack DM dispatched via{' '}
                    <span className="font-mono text-[#a3aac4]">#strafe-bot</span>
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full bg-white text-black py-3 border-4 border-black font-black text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Done
              </button>
            </>
          )}

          {/* ── REJECTED STATE ── */}
          {isRejected && !isEditing && (
            <button
              onClick={onClose}
              className="w-full bg-[#192540] text-[#dee5ff] py-3 border-2 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Close
            </button>
          )}

          {/* ── DRAFT STATE ── */}
          {isEditing && (
             <div className="flex gap-3">
               <button
                 onClick={handleSave}
                 disabled={isSaving}
                 className="flex-1 py-3 bg-[#bd9dff] text-[#3c0089] border-2 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                 style={{ fontFamily: 'var(--font-space-grotesk)' }}
               >
                 {isSaving ? 'Saving…' : 'Save Changes'}
               </button>
               <button
                 onClick={() => {
                   setIsEditing(false)
                   setEditTitle(localTicket.title)
                   setEditDescription(localTicket.description || '')
                   setEditStoryPoints(localTicket.story_points || 3)
                   setError(null)
                 }}
                 className="px-6 py-3 border-2 border-black text-[#a3aac4] font-bold hover:text-white transition-colors"
                 style={{ fontFamily: 'var(--font-space-grotesk)' }}
               >
                 Cancel
               </button>
             </div>
          )}

          {isDraft && !isEditing && (
            <>
              {showConfirm ? (
                <div className="space-y-4">
                  <p className="text-sm text-[#a3aac4]">
                    This will create a Jira ticket
                    {localTicket.suggested_assignee_name && ` and notify ${localTicket.suggested_assignee_name}`}.
                    Continue?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="flex-1 py-3 bg-green-500 text-black border-2 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      {isApproving ? 'Creating…' : 'Yes, create ticket'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-6 py-3 border-2 border-black text-[#a3aac4] font-bold hover:text-white transition-colors"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
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
                    className="w-full px-3 py-2 bg-[#0f1930] border-2 border-black text-[#dee5ff] placeholder-[#6d758c] text-sm focus:outline-none focus:border-[#ff6e84] resize-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleReject}
                      disabled={isRejecting}
                      className="flex-1 py-3 bg-[#ff6e84] text-[#490013] border-2 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      {isRejecting ? 'Rejecting…' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="px-6 py-3 border-2 border-black text-[#a3aac4] font-bold hover:text-white transition-colors"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    className="flex-1 py-3 bg-[#bd9dff] text-[#3c0089] border-2 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    Approve → Jira
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="px-6 py-3 border-2 border-[#ff6e84] text-[#ff6e84] font-bold hover:bg-[#ff6e84]/10 transition-colors"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
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
