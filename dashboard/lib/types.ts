// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------

export interface User {
  id: string
  email?: string | null
  name?: string | null
  picture?: string | null
  team?: string | null
}

export interface Session {
  user: User
  accessToken: string
  expiresAt: number
}

// ---------------------------------------------------------------------------
// Integration types
// ---------------------------------------------------------------------------

export interface ServiceStatus {
  connected: boolean
  workspace?: string
  user?: string
  org?: string
}

export interface IntegrationStatusResponse {
  jira: ServiceStatus
  github: ServiceStatus
  google_calendar: ServiceStatus
}

export interface DisconnectResponse {
  success: boolean
  message: string
}

// ---------------------------------------------------------------------------
// Ticket types
// ---------------------------------------------------------------------------

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type TicketStatus = 'draft' | 'approved' | 'rejected' | 'created'
export type OriginType = 'adhoc' | 'planned'
export type TriggerMode = 'automatic' | 'slash_command' | 'emoji_reaction'

export interface Ticket {
  id: string
  detected_task_id: string | null
  jira_ticket_id: string | null
  jira_ticket_url: string | null
  title: string
  description: string
  priority: TicketPriority
  labels: string[]
  story_points: number
  suggested_assignee_slack_id: string | null
  suggested_assignee_name: string | null
  assignee_reason: string | null
  source_thread_url: string | null
  source_channel_id: string | null
  source_channel_name: string | null
  source_thread_ts: string | null
  origin_type: OriginType
  trigger_mode: TriggerMode
  status: TicketStatus
  rejection_reason: string | null
  is_mock?: boolean
  created_at: string
  updated_at: string
}

export interface TicketListResponse {
  tickets: Ticket[]
  total: number
}

export interface TicketApproveResponse {
  id: string
  jira_ticket_id: string | null
  jira_ticket_url: string | null
  status: TicketStatus
  message: string
}

// ---------------------------------------------------------------------------
// Agent decision types
// ---------------------------------------------------------------------------

export interface AgentDecision {
  id: string
  ticket_id: string | null
  detected_task_id: string | null
  action: 'auto_assigned' | 'flagged_for_review' | 'dismissed' | 'pattern_matched'
  confidence: number
  reasoning: string
  assignee_name: string | null
  assignee_reason: string | null
  jira_ticket_id: string | null
  channel_name: string
  story_points: number | null
  auto_approved: boolean
  created_at: string
}

export interface AgentDecisionsResponse {
  decisions: AgentDecision[]
  total: number
}

export type AgentDecisionsListResponse = AgentDecisionsResponse

export interface AgentStatusResponse {
  agent_status: 'active' | 'idle' | 'offline'
  monitored_channels: number
  decisions_today: number
  auto_assigned_today: number
  flagged_for_review_today: number
  dismissed_today: number
  avg_confidence_today: number
  last_decision_at: string | null
  active_sprint: string | null
  sprint_adhoc_percentage: number | null
}

// ---------------------------------------------------------------------------
// Analytics types
// ---------------------------------------------------------------------------

export interface SprintBreakdown {
  sprint_id: string
  sprint_name: string
  state: 'active' | 'closed' | 'future'
  start_date: string | null
  end_date: string | null
  adhoc_count: number
  planned_count: number
  total_count: number
  adhoc_percentage: number
  planned_percentage: number
  total_story_points_adhoc: number
  total_story_points_planned: number
  total_story_points: number
  top_source_channel: string | null
}

export interface SprintsResponse {
  sprints: SprintBreakdown[]
  total: number
}

export interface ChannelBreakdownItem {
  channel_name: string
  count: number
  percentage: number
}

export interface ChannelsResponse {
  channels: ChannelBreakdownItem[]
  since_days: number
}

export interface EngineerLoadItem {
  engineer_name: string
  engineer_slack_id: string | null
  adhoc_tickets: number
  adhoc_points: number
}

export interface EngineerWorkloadItem {
  engineer_name: string
  engineer_slack_id: string | null
  adhoc_tickets: number
  adhoc_points: number
  planned_tickets: number
  planned_points: number
  total_points: number
  adhoc_percentage: number
  top_domain: string | null
  trend: 'up' | 'down' | 'flat'
  last_sprint_adhoc_points: number
}

export interface TeamStats {
  total_adhoc_points: number
  most_impacted_name: string | null
  most_impacted_points: number
  engineers_with_adhoc: number
  total_engineers: number
  pct_carrying_adhoc: number
}

export interface EngineersResponse {
  engineers: EngineerWorkloadItem[]
  team_stats: TeamStats
}

export interface TrendItem {
  sprint_id: string
  sprint_name: string
  adhoc_percentage: number
  adhoc_count: number
  planned_count: number
  start_date: string | null
}

export interface TrendResponse {
  trend: TrendItem[]
  num_sprints: number
}

export interface TopChannelItem {
  channel_name: string
  count: number
  story_points: number
}

export interface ComparisonResponse {
  current_percentage: number
  last_percentage: number
  difference: number
  direction: 'up' | 'down' | 'flat'
  message: string
}

export interface SummaryResponse {
  current_sprint: SprintBreakdown | null
  trend: TrendItem[]
  top_source_channels: TopChannelItem[]
  top_engineers_adhoc_load: EngineerLoadItem[]
  comparison_to_last_sprint: ComparisonResponse | null
  total_adhoc_this_sprint: number
}

export type AnalyticsSummary = SummaryResponse

// ---------------------------------------------------------------------------
// Expertise graph types
// ---------------------------------------------------------------------------

export interface ExpertiseDomain {
  domain: string
  score: number
}

export interface ExpertiseNode {
  id: string
  name: string
  github_login: string
  avatar_url: string | null
  expertise: ExpertiseDomain[]
  top_domain: string
}

export interface ExpertiseEdge {
  source: string
  target: string
  shared_domains: string[]
  weight: number
}

export interface ExpertiseGraphResponse {
  nodes: ExpertiseNode[]
  edges: ExpertiseEdge[]
}

export type ExpertiseGraph = ExpertiseGraphResponse

export interface ExpertiseSyncStatus {
  status: 'running' | 'success' | 'failed' | 'never'
  task_id: string | null
  started_at: string | null
  synced_at: string | null
  contributors_analyzed: number
  domains_extracted: number
  error_message: string | null
}

export type GithubSyncStatus = ExpertiseSyncStatus

export interface ExpertiseSyncTriggerResponse {
  task_id: string
  status: string
}

export type SyncTriggerResponse = ExpertiseSyncTriggerResponse

// ---------------------------------------------------------------------------
// Live Slack scan types
// ---------------------------------------------------------------------------

export interface SlackScanStatus {
  status: 'never' | 'pending' | 'running' | 'success' | 'failed'
  scan_id: string | null
  started_at: string | null
  completed_at: string | null
  since_hours: number
  channels_scanned: number
  threads_found: number
  tickets_generated: number
  error_message: string | null
}

export interface SlackScanTriggerResponse {
  scan_id: string
  task_id: string
  status: string
  message: string
}
