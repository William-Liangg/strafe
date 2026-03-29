// ---------------------------------------------------------------------------
// Integration types
// ---------------------------------------------------------------------------

export interface ServiceStatus {
  connected: boolean
  workspace?: string
  user?: string
  org?: string
}

// ---------------------------------------------------------------------------
// Ticket types
// ---------------------------------------------------------------------------

export interface Ticket {
  id: string
  detected_task_id: string | null
  jira_ticket_id: string | null
  jira_ticket_url: string | null
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  labels: string[]
  story_points: number
  suggested_assignee_slack_id: string | null
  suggested_assignee_name: string | null
  assignee_reason: string | null
  source_thread_url: string | null
  source_channel_id: string | null
  source_channel_name: string | null
  source_thread_ts: string | null
  origin_type: 'adhoc' | 'planned'
  trigger_mode: 'automatic' | 'slash_command' | 'emoji_reaction'
  status: 'draft' | 'approved' | 'rejected' | 'created'
  rejection_reason: string | null
  is_mock: boolean
  created_at: string
  updated_at: string
}

export interface TicketListResponse {
  tickets: Ticket[]
  total: number
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

export interface AgentDecisionsListResponse {
  decisions: AgentDecision[]
  total: number
}

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

export interface AnalyticsSummary {
  active_sprint: string | null
  sprint_adhoc_percentage: number | null
  total_tickets_this_sprint: number
  adhoc_tickets_this_sprint: number
  planned_tickets_this_sprint: number
  top_source_channel: string | null
  total_engineers: number
  monitored_channels: number
}

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

export interface ExpertiseGraph {
  nodes: ExpertiseNode[]
  edges: ExpertiseEdge[]
}

export interface GithubSyncStatus {
  status: 'running' | 'success' | 'failed' | 'never'
  task_id: string | null
  started_at: string | null
  synced_at: string | null
  contributors_analyzed: number
  domains_extracted: number
  error_message: string | null
}

export interface SyncTriggerResponse {
  task_id: string
  status: string
}

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
