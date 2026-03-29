import useSWR, { type SWRConfiguration } from 'swr'
import {
  fetchTasks,
  fetchTickets,
  fetchAgentDecisions,
  fetchAgentStatus,
  fetchAnalyticsSummary,
  fetchEngineers,
  fetchChannels,
  fetchSprints,
  fetchExpertiseGraph,
  fetchExpertiseSyncStatus,
  fetchSlackScanStatus,
  fetchLiveChannels,
  fetchIntegrationStatus,
} from '@/lib/api'
import type {
  DetectedTask,
  TicketListResponse,
  AgentDecisionsResponse,
  AgentStatusResponse,
  SummaryResponse,
  EngineersResponse,
  ChannelsResponse,
  SprintsResponse,
  ExpertiseGraphResponse,
  ExpertiseSyncStatus,
  SlackScanStatus,
  IntegrationStatusResponse,
  LiveChannel,
} from '@/lib/types'

const DEFAULT_OPTS: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 5000,
}

// ---------------------------------------------------------------------------
// Ticket hooks
// ---------------------------------------------------------------------------

export function useTasks(opts?: {
  status?: string
  classification?: string
  enabled?: boolean
}) {
  const enabled = opts?.enabled ?? true

  return useSWR<DetectedTask[]>(
    enabled ? ['tasks', opts?.status, opts?.classification] : null,
    () => fetchTasks({ status: opts?.status, classification: opts?.classification }),
    DEFAULT_OPTS,
  )
}

export function useTickets(
  status?: string,
  isMock?: boolean,
  opts?: {
    enabled?: boolean
  },
) {
  const enabled = opts?.enabled ?? true

  return useSWR<TicketListResponse>(
    enabled ? ['tickets', status, isMock] : null,
    () => fetchTickets(status, isMock),
    DEFAULT_OPTS,
  )
}

// ---------------------------------------------------------------------------
// Agent hooks
// ---------------------------------------------------------------------------

export function useAgentDecisions(action?: string, limit = 50, isMock?: boolean) {
  return useSWR<AgentDecisionsResponse>(
    ['agent-decisions', action, limit, isMock],
    () => fetchAgentDecisions(action, limit, isMock),
    { ...DEFAULT_OPTS, refreshInterval: 10_000 },
  )
}

export function useAgentStatus(isMock?: boolean) {
  return useSWR<AgentStatusResponse>(
    ['agent-status', isMock],
    () => fetchAgentStatus(isMock),
    { ...DEFAULT_OPTS, refreshInterval: 15_000 },
  )
}

// ---------------------------------------------------------------------------
// Analytics hooks
// ---------------------------------------------------------------------------

export function useSummary() {
  return useSWR<SummaryResponse>(
    'analytics-summary',
    fetchAnalyticsSummary,
    { ...DEFAULT_OPTS, refreshInterval: 30_000 },
  )
}

export function useEngineers(sprintId?: string) {
  return useSWR<EngineersResponse>(
    ['analytics-engineers', sprintId],
    () => fetchEngineers(sprintId),
    DEFAULT_OPTS,
  )
}

export function useChannels(opts?: { since_days?: number }) {
  const sinceDays = opts?.since_days ?? 30
  return useSWR<ChannelsResponse>(
    ['analytics-channels', sinceDays],
    () => fetchChannels(sinceDays),
    DEFAULT_OPTS,
  )
}

export function useSprints(opts?: { state?: string; limit?: number }) {
  return useSWR<SprintsResponse>(
    ['analytics-sprints', opts?.state, opts?.limit],
    () => fetchSprints(opts),
    DEFAULT_OPTS,
  )
}

// ---------------------------------------------------------------------------
// Expertise hooks
// ---------------------------------------------------------------------------

export function useExpertiseGraph() {
  return useSWR<ExpertiseGraphResponse>(
    'expertise-graph',
    fetchExpertiseGraph,
    { ...DEFAULT_OPTS, revalidateOnFocus: true },
  )
}

export function useExpertiseSyncStatus(pollWhileRunning = false) {
  return useSWR<ExpertiseSyncStatus>(
    'expertise-sync-status',
    fetchExpertiseSyncStatus,
    {
      ...DEFAULT_OPTS,
      refreshInterval: pollWhileRunning ? 2_000 : 0,
    },
  )
}

// ---------------------------------------------------------------------------
// Live Slack scan hook
// ---------------------------------------------------------------------------

export function useIntegrationStatus() {
  return useSWR<IntegrationStatusResponse>('integrations', fetchIntegrationStatus, DEFAULT_OPTS)
}

export function useLiveChannels(enabled = true) {
  return useSWR<LiveChannel[]>(
    enabled ? 'live-channels' : null,
    fetchLiveChannels,
    DEFAULT_OPTS,
  )
}

export function useSlackScanStatus(
  options:
    | boolean
    | {
        enabled?: boolean
        pollWhileRunning?: boolean
        pollIntervalMs?: number
      } = false,
) {
  const enabled = typeof options === 'boolean' ? true : options.enabled ?? true
  const pollWhileRunning = typeof options === 'boolean' ? options : options.pollWhileRunning ?? false
  const pollIntervalMs = typeof options === 'boolean' ? 2_000 : options.pollIntervalMs ?? 2_000

  return useSWR<SlackScanStatus>(
    enabled ? 'slack-scan-status' : null,
    fetchSlackScanStatus,
    {
      ...DEFAULT_OPTS,
      refreshInterval: (latestData) => {
        if (!pollWhileRunning) {
          return 0
        }

        if (!latestData) {
          return pollIntervalMs
        }

        return ['pending', 'running'].includes(latestData.status) ? pollIntervalMs : 0
      },
    },
  )
}
