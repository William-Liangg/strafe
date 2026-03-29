'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Bot, RadioTower, Ticket as TicketIcon, Waves } from 'lucide-react'
import { approveTicket, consumeQueuedLiveScanRequest, rejectTicket, triggerSlackScan } from '@/lib/api'
import { useLiveChannels, useSlackScanStatus, useTasks, useTickets } from '@/lib/hooks'
import type { DetectedTask, LiveChannel, Ticket } from '@/lib/types'

type FeedMode = 'demo' | 'live'
type QueuedLiveScan = {
  requestedAt: number
  sinceHours: number
}

function readFeedModeFromCookie(): FeedMode {
  if (typeof document === 'undefined') {
    return 'demo'
  }

  return document.cookie.split('; ').some((cookie) => cookie === 'demo_mode=true')
    ? 'demo'
    : 'live'
}

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

function PageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-[#f9faf0]">
      <div className="px-8 py-8 space-y-6">
        <div className="h-20 rounded-3xl bg-[#ebf0e0] animate-pulse" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-36 rounded-3xl bg-[#ebf0e0] animate-pulse" />
          ))}
        </div>
        {[1, 2].map((index) => (
          <div key={index} className="h-40 rounded-3xl bg-white animate-pulse" />
        ))}
      </div>
    </div>
  )
}

function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#f9faf0] px-8 py-8">
      <div className="bg-white rounded-3xl p-6 flex items-center gap-4 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#9f403d] shrink-0" />
        <p className="flex-1 text-[#9f403d] text-sm font-medium">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-white text-sm font-semibold rounded-2xl transition-opacity hover:opacity-90"
          style={{ fontFamily: 'var(--font-manrope)', background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' }}
        >
          Retry
        </button>
      </div>
    </div>
  )
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) {
    return 'just now'
  }

  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

function sortByCreatedAtDesc<T extends { created_at: string | null }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0
    return rightTime - leftTime
  })
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)
}

function priorityMeta(priority: Ticket['priority']) {
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

function ticketStatusMeta(status: Ticket['status']) {
  switch (status) {
    case 'created':
      return { label: 'Sent To Jira', pip: 'bg-[#3a6b4a]', labelClass: 'text-[#3a6b4a]' }
    case 'approved':
      return { label: 'Approved', pip: 'bg-[#5f5e5e]', labelClass: 'text-[#5f5e5e]' }
    case 'rejected':
      return { label: 'Dismissed', pip: 'bg-[#b8c4a8]', labelClass: 'text-[#757d6b]' }
    default:
      return { label: 'Queued For Review', pip: 'bg-[#a07842]', labelClass: 'text-[#a07842]' }
  }
}

function classificationLabel(classification: string) {
  switch (classification) {
    case 'feature_request':
      return 'Feature Request'
    default:
      return classification.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
  }
}

function taskStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function sourceLabel(ticket: Ticket): string {
  if (ticket.source_channel_name) {
    return `#${ticket.source_channel_name.replace(/^#/, '')}`
  }

  return '#unknown'
}

function taskSourceLabel(task: DetectedTask): string {
  if (task.thread?.channel_id) {
    return task.thread.channel_id
  }

  return 'Unmapped thread'
}

function FeedStatCard({
  label,
  value,
  caption,
  accentClass,
}: {
  label: string
  value: string
  caption: string
  accentClass: string
}) {
  return (
    <div className="relative bg-[#ebf0e0] border-2 border-[#2d3526] p-6 overflow-hidden shadow-[4px_4px_0px_0px_#2d3526]">
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentClass}`} />
      <div className="pl-4">
        <p className="text-xs font-black uppercase tracking-widest text-[#b8c4a8] mb-3" style={{ fontFamily: 'var(--font-manrope)' }}>
          {label}
        </p>
        <p className="text-4xl font-black text-[#2d3526]" style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}>
          {value}
        </p>
        <p className="text-xs text-[#757d6b] mt-1">{caption}</p>
      </div>
    </div>
  )
}

function DraftTicketCard({
  ticket,
  contextText,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  ticket: Ticket
  contextText?: string
  onApprove: () => void
  onReject: () => void
  isApproving: boolean
  isRejecting: boolean
}) {
  const meta = priorityMeta(ticket.priority)

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
            <span className="text-[#757d6b] text-sm">{sourceLabel(ticket)}</span>
          </div>
          <h3
            className="text-xl font-bold leading-tight text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}
          >
            {ticket.title}
          </h3>
        </div>
        <span className="text-xs text-[#757d6b] shrink-0 ml-6">
          {formatRelativeTime(ticket.created_at)}
        </span>
      </div>

      {(contextText || ticket.description) && (
        <div className="mb-6 pl-4 border-l-2 border-[#ebf0e0]">
          <p className="text-[#757d6b] text-sm leading-relaxed italic">
            &ldquo;{contextText ?? ticket.description}&rdquo;
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

function ProcessedTicketCard({
  ticket,
  task,
}: {
  ticket: Ticket
  task?: DetectedTask
}) {
  const meta = ticketStatusMeta(ticket.status)
  const confidencePct = task ? `${Math.round(task.confidence * 100)}% confidence` : null
  const contextText = task?.description ?? ticket.description

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
            <span className="text-[#757d6b] text-sm">{sourceLabel(ticket)}</span>
          </div>
          <h3
            className="text-xl font-bold leading-tight text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}
          >
            {ticket.title}
          </h3>
        </div>
        <span className="text-xs text-[#757d6b] shrink-0 ml-6">
          {formatRelativeTime(ticket.created_at)}
        </span>
      </div>

      {contextText && (
        <div className="mb-5 pl-4 border-l-2 border-[#ebf0e0]">
          <p className="text-[#757d6b] text-sm leading-relaxed italic">
            &ldquo;{contextText}&rdquo;
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
                  Assignee
                </p>
                <p className="text-sm font-semibold text-[#2d3526]">{ticket.suggested_assignee_name}</p>
              </div>
            </>
          )}
        </div>
        <div className="text-right">
          {ticket.jira_ticket_id && (
            <p className="text-xs font-mono text-[#5f5e5e] bg-[#f2f5e8] px-2 py-1 rounded-lg inline-block">
              {ticket.jira_ticket_id}
            </p>
          )}
          {confidencePct && (
            <p className="text-xs text-[#757d6b] mt-2">{confidencePct}</p>
          )}
        </div>
      </div>
    </article>
  )
}

function DetectedTaskCard({ task }: { task: DetectedTask }) {
  return (
    <article className="bg-white rounded-3xl p-7 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#5f5e5e]" />
            <span
              className="text-[#5f5e5e] font-semibold text-xs uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {classificationLabel(task.classification)}
            </span>
            <span className="text-[#b8c4a8] text-xs">·</span>
            <span className="text-[#757d6b] text-sm">{taskSourceLabel(task)}</span>
          </div>
          <h3
            className="text-xl font-bold leading-tight text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}
          >
            {task.title ?? 'Detected Slack Thread'}
          </h3>
        </div>
        <span className="text-xs text-[#757d6b] shrink-0 ml-6">
          {formatRelativeTime(task.created_at)}
        </span>
      </div>

      {task.description && (
        <div className="mb-5 pl-4 border-l-2 border-[#ebf0e0]">
          <p className="text-[#757d6b] text-sm leading-relaxed italic">
            &ldquo;{task.description}&rdquo;
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-5 border-t border-[#b8c4a8]/20">
        <div className="text-xs text-[#757d6b]">
          {task.thread?.reply_count ?? 0} replies · {Math.round(task.confidence * 100)}% confidence
        </div>
        <span className="text-xs font-medium text-[#5f5e5e] bg-[#f2f5e8] px-2 py-1 rounded-lg">
          {taskStatusLabel(task.status)}
        </span>
      </div>
    </article>
  )
}

export default function AgentPage() {
  const [feedMode, setFeedMode] = useState<FeedMode | null>(null)
  const [queuedLiveScanRequest, setQueuedLiveScanRequest] = useState<QueuedLiveScan | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const liveScanHandledRef = useRef(false)
  const lastCompletedScanRef = useRef<string | null>(null)

  useEffect(() => {
    const mode = readFeedModeFromCookie()
    setFeedMode(mode)
    setQueuedLiveScanRequest(mode === 'live' ? consumeQueuedLiveScanRequest() : null)
  }, [])

  const isModeReady = feedMode !== null
  const isDemoMode = feedMode === 'demo'
  const isLiveMode = feedMode === 'live'

  const { data: tasksData, error: tasksError, mutate: mutateTasks } = useTasks({
    enabled: isModeReady,
  })
  const { data: ticketsData, error: ticketsError, mutate: mutateTickets } = useTickets(
    undefined,
    undefined,
    { enabled: isModeReady },
  )
  const { data: liveChannelsData, error: liveChannelsError, mutate: mutateLiveChannels } = useLiveChannels(isLiveMode)
  const { data: scanStatus, error: scanStatusError, mutate: mutateScanStatus } = useSlackScanStatus({
    enabled: isLiveMode,
    pollWhileRunning: true,
    pollIntervalMs: 3_000,
  })

  useEffect(() => {
    if (!isLiveMode || !scanStatus) {
      return
    }

    if (liveScanHandledRef.current) {
      return
    }

    if (scanStatus.status === 'pending' || scanStatus.status === 'running') {
      liveScanHandledRef.current = true
      return
    }

    if (queuedLiveScanRequest === null) {
      return
    }

    const scanStartedAt = scanStatus.started_at ? new Date(scanStatus.started_at).getTime() : 0
    if (scanStatus.status !== 'never' && scanStartedAt >= queuedLiveScanRequest.requestedAt - 5_000) {
      liveScanHandledRef.current = true
      return
    }

    liveScanHandledRef.current = true

    void triggerSlackScan(queuedLiveScanRequest.sinceHours)
      .then(() => mutateScanStatus())
      .catch((error) => {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('409')) {
          void mutateScanStatus()
          return
        }

        console.error('Failed to trigger live scan:', error)
      })
  }, [isLiveMode, mutateScanStatus, queuedLiveScanRequest, scanStatus])

  useEffect(() => {
    if (!isLiveMode || !scanStatus || scanStatus.status !== 'success') {
      return
    }

    const completionMarker = scanStatus.scan_id && scanStatus.completed_at
      ? `${scanStatus.scan_id}:${scanStatus.completed_at}`
      : null

    if (!completionMarker || lastCompletedScanRef.current === completionMarker) {
      return
    }

    lastCompletedScanRef.current = completionMarker
    void mutateTasks()
    void mutateTickets()
    void mutateLiveChannels()
  }, [isLiveMode, mutateLiveChannels, mutateTasks, mutateTickets, scanStatus])

  const tasks = useMemo(() => sortByCreatedAtDesc(tasksData ?? []), [tasksData])
  const tickets = useMemo(
    () => sortByCreatedAtDesc(ticketsData?.tickets ?? []),
    [ticketsData?.tickets],
  )
  const liveChannels = liveChannelsData ?? []
  const activeLiveChannels = liveChannels.filter((channel) => channel.monitoring_active)

  const visibleTickets = useMemo(
    () => (isLiveMode ? tickets.filter((ticket) => ticket.source_thread_url !== null) : tickets),
    [isLiveMode, tickets],
  )

  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  )

  const draftTickets = visibleTickets.filter((ticket) => ticket.status === 'draft')
  const processedTickets = visibleTickets.filter((ticket) => ticket.status !== 'draft')

  const matchedTaskIds = new Set(
    visibleTickets
      .map((ticket) => ticket.detected_task_id)
      .filter((taskId): taskId is string => Boolean(taskId)),
  )

  const unmatchedTasks = tasks.filter((task) => !matchedTaskIds.has(task.id))

  const uniqueSourceChannels = new Set(
    visibleTickets
      .map((ticket) => ticket.source_channel_name)
      .filter((channelName): channelName is string => Boolean(channelName)),
  )

  const headerStatusText = isDemoMode
    ? 'Demo mode · seeded tasks and tickets'
    : `${activeLiveChannels.length} monitored channels`

  const pageError = tasksError
    ?? ticketsError
    ?? (isLiveMode ? liveChannelsError ?? scanStatusError : null)

  const isInitialLoading = !isModeReady
    || !tasksData
    || !ticketsData
    || (isLiveMode && (!scanStatus || !liveChannelsData))

  const handleApprove = async (ticket: Ticket) => {
    setApprovingId(ticket.id)
    try {
      await approveTicket(ticket.id)
      await Promise.all([mutateTickets(), mutateTasks()])
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async (ticket: Ticket) => {
    setRejectingId(ticket.id)
    try {
      await rejectTicket(ticket.id, 'Rejected via live feed')
      await Promise.all([mutateTickets(), mutateTasks()])
    } finally {
      setRejectingId(null)
    }
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)

    const operations: Promise<unknown>[] = [
      mutateTasks(),
      mutateTickets(),
      new Promise((resolve) => setTimeout(resolve, 800)),
    ]

    if (isLiveMode) {
      operations.push(mutateLiveChannels())
      operations.push(mutateScanStatus())
    }

    await Promise.all(operations)
    setIsRefreshing(false)
  }, [isLiveMode, mutateLiveChannels, mutateScanStatus, mutateTasks, mutateTickets])

  if (isInitialLoading) {
    return <PageSkeleton />
  }

  if (pageError) {
    return (
      <PageError
        message={pageError.message || 'Failed to load live feed'}
        onRetry={() => {
          void handleRefresh()
        }}
      />
    )
  }

  const showLiveEmptyState = isLiveMode
    && scanStatus?.status === 'success'
    && scanStatus.threads_found === 0
    && visibleTickets.length === 0
    && unmatchedTasks.length === 0

  return (
    <div className="flex flex-col min-h-screen bg-[#f9faf0]">
      <LoadingBar isLoading={isRefreshing} />

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
            {isDemoMode ? 'Demo' : 'Live'}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span className="hidden md:block text-sm text-[#757d6b]">
            {headerStatusText}
          </span>
          {isLiveMode && ['pending', 'running'].includes(scanStatus?.status ?? '') && (
            <span className="text-sm text-[#757d6b] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3a6b4a] animate-pulse inline-block" />
              Scanning Slack…
            </span>
          )}
          <button
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="px-5 py-2 text-white text-sm font-semibold rounded-2xl transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-manrope)', background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' }}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Feed'}
          </button>
        </div>
      </header>

      <main className="flex-1 px-8 py-8 space-y-8">
        {isLiveMode && scanStatus && ['pending', 'running', 'success', 'failed'].includes(scanStatus.status) && (
          <section className="bg-white rounded-3xl p-5 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
            {scanStatus.status === 'success' ? (
              <p className="text-sm text-[#3a6b4a]">
                Slack scan complete. {scanStatus.channels_scanned} channels scanned, {scanStatus.threads_found} threads found, {scanStatus.tickets_generated} tickets generated.
              </p>
            ) : scanStatus.status === 'failed' ? (
              <p className="text-sm text-[#9f403d]">{scanStatus.error_message ?? 'Slack scan failed.'}</p>
            ) : (
              <p className="text-sm text-[#757d6b]">
                Scanning your Slack workspace. {scanStatus.channels_scanned} channels scanned, {scanStatus.threads_found} candidate threads found so far.
              </p>
            )}
          </section>
        )}

        <section className="grid grid-cols-3 gap-6">
          <FeedStatCard
            label="Detected Threads"
            value={String(tasks.length)}
            caption={isDemoMode ? 'Seeded threads in the demo feed' : 'Slack threads detected in live mode'}
            accentClass="bg-[#5f5e5e]"
          />
          <FeedStatCard
            label="Review Queue"
            value={String(draftTickets.length)}
            caption="Tickets still waiting for approval"
            accentClass={draftTickets.length > 0 ? 'bg-[#9f403d]' : 'bg-[#3a6b4a]'}
          />
          <FeedStatCard
            label={isDemoMode ? 'Source Channels' : 'Monitored Channels'}
            value={String(isDemoMode ? uniqueSourceChannels.size : activeLiveChannels.length)}
            caption={isDemoMode ? 'Channels represented in the seeded feed' : 'Slack channels currently being watched'}
            accentClass="bg-[#a07842]"
          />
        </section>

        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-2xl font-black uppercase tracking-tight text-[#2d3526]"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Recent Dispatches
            </h2>
            <p className="text-sm text-[#757d6b] mt-0.5">
              {isDemoMode
                ? 'Seeded demo tasks and tickets'
                : 'Threads and tickets coming from your connected Slack channels'}
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

        <section className="space-y-5">
          {showLiveEmptyState && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <Bot className="h-8 w-8 text-[#b8c4a8]" />
              <p className="text-lg font-semibold text-[#2d3526]" style={{ fontFamily: 'var(--font-manrope)' }}>
                No live threads detected yet. Make sure Slack is connected and channels are synced.
              </p>
            </div>
          )}

          {!showLiveEmptyState && visibleTickets.length === 0 && unmatchedTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <Bot className="h-8 w-8 text-[#b8c4a8]" />
              <p className="text-lg font-semibold text-[#2d3526]" style={{ fontFamily: 'var(--font-manrope)' }}>
                No activity yet
              </p>
              <p className="text-sm text-[#757d6b]">
                {isDemoMode
                  ? 'The demo feed will render seeded tasks and tickets here.'
                  : 'Slack activity will appear here after the live scan completes.'}
              </p>
            </div>
          )}

          {draftTickets.map((ticket) => (
            <DraftTicketCard
              key={ticket.id}
              ticket={ticket}
              contextText={ticket.detected_task_id ? taskById.get(ticket.detected_task_id)?.description ?? undefined : undefined}
              onApprove={() => void handleApprove(ticket)}
              onReject={() => void handleReject(ticket)}
              isApproving={approvingId === ticket.id}
              isRejecting={rejectingId === ticket.id}
            />
          ))}

          {unmatchedTasks.map((task) => (
            <DetectedTaskCard key={task.id} task={task} />
          ))}

          {processedTickets.slice(0, 20).map((ticket) => (
            <ProcessedTicketCard
              key={ticket.id}
              ticket={ticket}
              task={ticket.detected_task_id ? taskById.get(ticket.detected_task_id) : undefined}
            />
          ))}
        </section>

        {isLiveMode && activeLiveChannels.length > 0 && (
          <section className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
            <div className="flex items-center gap-3 mb-5">
              <RadioTower className="h-5 w-5 text-[#757d6b]" />
              <div>
                <h2
                  className="text-base font-bold text-[#2d3526]"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  Live Channel Coverage
                </h2>
                <p className="text-sm text-[#757d6b] mt-0.5">
                  Channels currently enabled for live Slack scanning
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeLiveChannels.map((channel: LiveChannel) => (
                <span
                  key={channel.channel_id}
                  className="inline-flex items-center gap-2 rounded-full bg-[#f2f5e8] px-3 py-1.5 text-sm text-[#2d3526]"
                >
                  <Waves className="h-3.5 w-3.5 text-[#5f5e5e]" />
                  <span>{channel.channel_name}</span>
                  <span className="text-xs text-[#757d6b]">min replies {channel.min_replies}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <Bot className="h-5 w-5 text-[#757d6b]" />
              <div>
                <h3
                  className="text-base font-bold text-[#2d3526]"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  Detection Summary
                </h3>
                <p className="text-sm text-[#757d6b] mt-0.5">
                  Built directly from tasks and tickets
                </p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#757d6b]">Threads detected</span>
                <span className="font-semibold text-[#2d3526]">{tasks.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#757d6b]">Tickets generated</span>
                <span className="font-semibold text-[#2d3526]">{visibleTickets.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#757d6b]">Sent to Jira</span>
                <span className="font-semibold text-[#2d3526]">
                  {processedTickets.filter((ticket) => ticket.status === 'created').length}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
            <div className="flex items-center gap-3 mb-4">
              <TicketIcon className="h-5 w-5 text-[#757d6b]" />
              <div>
                <h3
                  className="text-base font-bold text-[#2d3526]"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  Feed Source
                </h3>
                <p className="text-sm text-[#757d6b] mt-0.5">
                  {isDemoMode ? 'Demo mode uses only the seeded endpoints' : 'Live mode uses Slack scan state and live ticket data'}
                </p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#757d6b]">Mode</span>
                <span className="font-semibold text-[#2d3526]">{isDemoMode ? 'Demo' : 'Live'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#757d6b]">Visible cards</span>
                <span className="font-semibold text-[#2d3526]">{visibleTickets.length + unmatchedTasks.length}</span>
              </div>
              {isLiveMode && scanStatus && (
                <div className="flex items-center justify-between">
                  <span className="text-[#757d6b]">Latest scan</span>
                  <span className="font-semibold text-[#2d3526]">{taskStatusLabel(scanStatus.status)}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
