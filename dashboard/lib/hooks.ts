import useSWR, { type SWRConfiguration } from 'swr'
import {
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
  fetchIntegrationStatus,
} from '@/lib/api'
import type {
  TicketListResponse,
  AgentDecisionsListResponse,
  AgentStatusResponse,
  AnalyticsSummary,
  ExpertiseGraph,
  GithubSyncStatus,
  SlackScanStatus,
} from '@/lib/types'

const DEFAULT_OPTS: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 5000,
}

// ---------------------------------------------------------------------------
// Ticket hooks
// ---------------------------------------------------------------------------

export function useTickets(status?: string, isMock?: boolean) {
  return useSWR<TicketListResponse>(
    ['tickets', status, isMock],
    () => fetchTickets(status, isMock),
    DEFAULT_OPTS,
  )
}

// ---------------------------------------------------------------------------
// Agent hooks
// ---------------------------------------------------------------------------

export function useAgentDecisions(action?: string, limit = 50, isMock?: boolean) {
  return useSWR<AgentDecisionsListResponse>(
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
  return useSWR<AnalyticsSummary>(
    'analytics-summary',
    fetchAnalyticsSummary,
    { ...DEFAULT_OPTS, refreshInterval: 30_000 },
  )
}

export function useEngineers(sprintId?: string) {
  return useSWR(
    ['analytics-engineers', sprintId],
    () => fetchEngineers(sprintId),
    DEFAULT_OPTS,
  )
}

export function useChannels(opts?: { since_days?: number }) {
  const sinceDays = opts?.since_days ?? 30
  return useSWR(
    ['analytics-channels', sinceDays],
    () => fetchChannels(sinceDays),
    DEFAULT_OPTS,
  )
}

export function useSprints(opts?: { state?: string; limit?: number }) {
  return useSWR(
    ['analytics-sprints', opts?.state, opts?.limit],
    () => fetchSprints(opts),
    DEFAULT_OPTS,
  )
}

// ---------------------------------------------------------------------------
// Expertise hooks
// ---------------------------------------------------------------------------

export function useExpertiseGraph() {
  return useSWR<ExpertiseGraph>(
    'expertise-graph',
    fetchExpertiseGraph,
    { ...DEFAULT_OPTS, revalidateOnFocus: true },
  )
}

export function useExpertiseSyncStatus(pollWhileRunning = false) {
  return useSWR<GithubSyncStatus>(
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
  return useSWR('integrations', fetchIntegrationStatus, DEFAULT_OPTS)
}

export function useSlackScanStatus(pollWhileRunning = false) {
  return useSWR<SlackScanStatus>(
    'slack-scan-status',
    fetchSlackScanStatus,
    {
      ...DEFAULT_OPTS,
      refreshInterval: pollWhileRunning ? 2_000 : 0,
    },
  )
}
