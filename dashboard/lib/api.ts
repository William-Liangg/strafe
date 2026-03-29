import type {
  TicketListResponse,
  AgentDecisionsListResponse,
  AgentStatusResponse,
  AnalyticsSummary,
  ExpertiseGraph,
  GithubSyncStatus,
  SyncTriggerResponse,
  SlackScanStatus,
  SlackScanTriggerResponse,
} from '@/lib/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'

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

export async function fetchTickets(status?: string, isMock?: boolean): Promise<TicketListResponse> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (isMock !== undefined) params.set('is_mock', String(isMock))
  const qs = params.toString() ? `?${params}` : ''
  return apiFetch<TicketListResponse>(`/tickets/${qs}`)
}

export async function approveTicket(id: string): Promise<void> {
  await apiFetch(`/tickets/${id}/approve`, { method: 'POST' })
}

export async function rejectTicket(id: string, reason?: string): Promise<void> {
  await apiFetch(`/tickets/${id}/reject`, {
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
): Promise<AgentDecisionsListResponse> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (action) params.set('action', action)
  if (isMock !== undefined) params.set('is_mock', String(isMock))
  return apiFetch<AgentDecisionsListResponse>(`/agent/decisions?${params}`)
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

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiFetch<AnalyticsSummary>('/analytics/summary')
}

export async function fetchEngineers(sprintId?: string) {
  const qs = sprintId ? `?sprint_id=${sprintId}` : ''
  return apiFetch(`/analytics/engineers${qs}`)
}

export async function fetchChannels(sinceDays = 30) {
  return apiFetch(`/analytics/channels?since_days=${sinceDays}`)
}

export async function fetchSprints(opts?: { state?: string; limit?: number }) {
  const params = new URLSearchParams()
  if (opts?.state) params.set('state', opts.state)
  if (opts?.limit) params.set('limit', String(opts.limit))
  const qs = params.toString() ? `?${params}` : ''
  return apiFetch(`/analytics/sprints${qs}`)
}

// ---------------------------------------------------------------------------
// Expertise graph
// ---------------------------------------------------------------------------

export async function fetchExpertiseGraph(): Promise<ExpertiseGraph> {
  return apiFetch<ExpertiseGraph>('/expertise/graph')
}

export async function triggerExpertiseSync(): Promise<SyncTriggerResponse> {
  return apiFetch<SyncTriggerResponse>('/expertise/sync', { method: 'POST' })
}

export async function fetchExpertiseSyncStatus(): Promise<GithubSyncStatus> {
  return apiFetch<GithubSyncStatus>('/expertise/sync/status')
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

export async function fetchLiveChannels(): Promise<{ channel_id: string; channel_name: string; monitoring_active: boolean; min_replies: number; is_real: boolean }[]> {
  return apiFetch('/live-feed/channels')
}

export async function bootstrapLiveFeed(sinceHours = 24): Promise<{
  cleared: Record<string, number>
  scan_id: string
  task_id: string
  status: string
  message: string
}> {
  return apiFetch(`/live-feed/bootstrap?since_hours=${sinceHours}&force=true`, { method: 'POST' })
}

export async function fetchIntegrationStatus(): Promise<{
  jira: { connected: boolean; workspace?: string; user?: string }
  github: { connected: boolean; workspace?: string; user?: string; org?: string }
  google_calendar: { connected: boolean; workspace?: string; user?: string }
}> {
  return apiFetch('/integrations/status')
}

export function getIntegrationConnectUrl(service: string): string {
  return `${API_BASE}/integrations/connect/${service}`
}

export async function disconnectIntegration(service: string): Promise<void> {
  return apiFetch(`/integrations/disconnect/${service}`, { method: 'POST' })
}
