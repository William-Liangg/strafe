import type {
  DetectedTask,
  TicketListResponse,
  Ticket,
  TicketApproveResponse,
  AgentDecisionsResponse,
  AgentStatusResponse,
  SummaryResponse,
  EngineersResponse,
  ChannelsResponse,
  SprintsResponse,
  ExpertiseGraphResponse,
  ExpertiseSyncStatus,
  ExpertiseSyncTriggerResponse,
  SlackScanStatus,
  SlackScanTriggerResponse,
  DisconnectResponse,
  IntegrationStatusResponse,
  LiveChannel,
} from '@/lib/types'

const API_BASE = '/api/proxy'
const LIVE_SCAN_QUEUE_KEY = 'strafe:queue-live-scan'

type QueuedLiveScanRequest = {
  requestedAt: number
  sinceHours: number
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export async function fetchTasks(opts?: {
  status?: string
  classification?: string
}): Promise<DetectedTask[]> {
  const params = new URLSearchParams()
  if (opts?.status) params.set('status', opts.status)
  if (opts?.classification) params.set('classification', opts.classification)
  const qs = params.toString() ? `?${params}` : ''
  return apiFetch<DetectedTask[]>(`/tasks${qs}`)
}

export async function fetchTickets(status?: string, isMock?: boolean): Promise<TicketListResponse> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (isMock !== undefined) params.set('is_mock', String(isMock))
  const qs = params.toString() ? `?${params}` : ''
  return apiFetch<TicketListResponse>(`/tickets${qs}`)
}

export async function approveTicket(id: string): Promise<TicketApproveResponse> {
  return apiFetch<TicketApproveResponse>(`/tickets/${id}/approve`, { method: 'POST' })
}

export async function rejectTicket(id: string, reason?: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/tickets/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? '' }),
  })
}

// ---------------------------------------------------------------------------
// Agent decisions
// ---------------------------------------------------------------------------

export async function fetchAgentDecisions(
  action?: string,
  limit = 50,
  isMock?: boolean,
): Promise<AgentDecisionsResponse> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (action) params.set('action', action)
  if (isMock !== undefined) params.set('is_mock', String(isMock))
  return apiFetch<AgentDecisionsResponse>(`/agent/decisions?${params}`)
}

export async function fetchAgentStatus(isMock?: boolean): Promise<AgentStatusResponse> {
  const params = new URLSearchParams()
  if (isMock !== undefined) params.set('is_mock', String(isMock))
  const qs = params.toString() ? `?${params}` : ''
  return apiFetch<AgentStatusResponse>(`/agent/status${qs}`)
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function fetchAnalyticsSummary(): Promise<SummaryResponse> {
  return apiFetch<SummaryResponse>('/analytics/summary')
}

export async function fetchEngineers(sprintId?: string): Promise<EngineersResponse> {
  const qs = sprintId ? `?sprint_id=${sprintId}` : ''
  return apiFetch<EngineersResponse>(`/analytics/engineers${qs}`)
}

export async function fetchChannels(sinceDays = 30): Promise<ChannelsResponse> {
  return apiFetch<ChannelsResponse>(`/analytics/channels?since_days=${sinceDays}`)
}

export async function fetchSprints(opts?: { state?: string; limit?: number }): Promise<SprintsResponse> {
  const params = new URLSearchParams()
  if (opts?.state) params.set('state', opts.state)
  if (opts?.limit) params.set('limit', String(opts.limit))
  const qs = params.toString() ? `?${params}` : ''
  return apiFetch<SprintsResponse>(`/analytics/sprints${qs}`)
}

// ---------------------------------------------------------------------------
// Expertise graph
// ---------------------------------------------------------------------------

export async function fetchExpertiseGraph(): Promise<ExpertiseGraphResponse> {
  return apiFetch<ExpertiseGraphResponse>('/expertise/graph')
}

export async function triggerExpertiseSync(): Promise<ExpertiseSyncTriggerResponse> {
  return apiFetch<ExpertiseSyncTriggerResponse>('/expertise/sync', { method: 'POST' })
}

export async function fetchExpertiseSyncStatus(): Promise<ExpertiseSyncStatus> {
  return apiFetch<ExpertiseSyncStatus>('/expertise/sync/status')
}

// ---------------------------------------------------------------------------
// Live Slack scan
// Live data adapter: triggers a pull-based scan of monitored Slack channels.
// Results are stored as is_mock=false tickets, separate from mock/seed data.
// ---------------------------------------------------------------------------

export async function triggerSlackScan(sinceHours = 24): Promise<SlackScanTriggerResponse> {
  return apiFetch<SlackScanTriggerResponse>(
    `/live-feed/scan?since_hours=${sinceHours}`,
    { method: 'POST' },
  )
}

export async function fetchSlackScanStatus(): Promise<SlackScanStatus> {
  return apiFetch<SlackScanStatus>('/live-feed/scan/status')
}

export async function syncBotChannels(): Promise<{ registered: number; updated: number; total_bot_channels: number; channels: { channel_id: string; channel_name: string }[] }> {
  return apiFetch('/live-feed/channels/sync', { method: 'POST' })
}

export async function fetchLiveChannels(): Promise<LiveChannel[]> {
  return apiFetch<LiveChannel[]>('/live-feed/channels')
}

export async function bootstrapLiveFeed(sinceHours = 24): Promise<SlackScanTriggerResponse> {
  if (typeof window !== 'undefined') {
    const payload: QueuedLiveScanRequest = {
      requestedAt: Date.now(),
      sinceHours,
    }
    window.sessionStorage.setItem(LIVE_SCAN_QUEUE_KEY, JSON.stringify(payload))
  }

  return triggerSlackScan(sinceHours)
}

export function consumeQueuedLiveScanRequest(): QueuedLiveScanRequest | null {
  if (typeof window === 'undefined') {
    return null
  }

  const queued = window.sessionStorage.getItem(LIVE_SCAN_QUEUE_KEY)
  if (!queued) {
    return null
  }

  window.sessionStorage.removeItem(LIVE_SCAN_QUEUE_KEY)

  try {
    const parsed = JSON.parse(queued) as Partial<QueuedLiveScanRequest>
    const sinceHours = Number(parsed.sinceHours)
    const requestedAt = Number(parsed.requestedAt)

    return {
      requestedAt: Number.isFinite(requestedAt) && requestedAt > 0 ? requestedAt : Date.now(),
      sinceHours: Number.isFinite(sinceHours) && sinceHours > 0 ? sinceHours : 24,
    }
  } catch {
    const sinceHours = Number(queued)
    return {
      requestedAt: Date.now(),
      sinceHours: Number.isFinite(sinceHours) && sinceHours > 0 ? sinceHours : 24,
    }
  }
}

export async function fetchIntegrationStatus(): Promise<IntegrationStatusResponse> {
  return apiFetch<IntegrationStatusResponse>('/integrations/status')
}

export function getIntegrationConnectUrl(service: string): string {
  return `/api/proxy/integrations/connect/${service}`
}

export async function disconnectIntegration(service: string): Promise<DisconnectResponse> {
  return apiFetch<DisconnectResponse>(`/integrations/disconnect/${service}`, { method: 'POST' })
}
