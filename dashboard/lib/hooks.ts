import useSWR from 'swr'
import type {
  SummaryResponse,
  TicketsResponse,
  SprintsResponse,
  EngineersResponse,
  ChannelsResponse,
} from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useSummary() {
  return useSWR<SummaryResponse>(`${API_BASE}/analytics/summary`, fetcher, {
    refreshInterval: 30000,
  })
}

export function useTickets() {
  return useSWR<TicketsResponse>(`${API_BASE}/tickets/`, fetcher, {
    refreshInterval: 15000,
  })
}

export function useSprints() {
  return useSWR<SprintsResponse>(`${API_BASE}/analytics/sprints`, fetcher, {
    refreshInterval: 60000,
  })
}

export function useEngineers() {
  return useSWR<EngineersResponse>(`${API_BASE}/analytics/engineers`, fetcher, {
    refreshInterval: 60000,
  })
}

export function useChannels() {
  return useSWR<ChannelsResponse>(`${API_BASE}/analytics/channels`, fetcher, {
    refreshInterval: 60000,
  })
}

export function useAgentStatus() {
  return useSWR<any>(`${API_BASE}/agent/status`, fetcher, {
    refreshInterval: 15000,
  })
}

export function useAgentDecisions(action?: string, limit: number = 50) {
  const query = new URLSearchParams()
  if (action) query.append('action', action)
  query.append('limit', limit.toString())

  return useSWR<any>(`${API_BASE}/agent/decisions?${query.toString()}`, fetcher, {
    refreshInterval: 15000,
  })
}