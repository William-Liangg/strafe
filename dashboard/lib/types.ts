export type TicketPriority = 'critical' | 'high' | 'medium' | 'low'
export type TicketStatus = 'draft' | 'approved' | 'rejected' | 'created'
export type OriginType = 'adhoc' | 'planned'
export type TriggerMode = 'automatic' | 'slash_command' | 'emoji' | 'manual'

export interface Ticket {
  id: string
  title: string
  description: string
  priority: TicketPriority
  status: TicketStatus
  story_points: number
  estimated_hours: number | null
  labels: string[]
  origin_type: OriginType
  trigger_mode: TriggerMode
  source_channel_name: string | null
  suggested_assignee_name: string | null
  assignee_reason: string | null
  related_ticket_id: string | null
  relation_type: string | null
  jira_ticket_id: string | null
  jira_ticket_url: string | null
  rejection_reason: string | null
  created_at: string
}

export interface TicketsResponse {
  tickets: Ticket[]
}

export interface SprintTrend {
  sprint_name: string
  sprint_id?: string
  adhoc_count: number
  planned_count: number
  adhoc_percentage: number
}

export interface SourceChannel {
  channel_name: string
  count: number
}

export interface EngineerLoad {
  engineer_slack_id: string
  engineer_name: string
  adhoc_tickets: number
  adhoc_points: number
}

export interface CurrentSprint {
  sprint_name: string
  state: string
  adhoc_count: number
  planned_count: number
  total_count: number
  adhoc_percentage: number
  top_source_channel: string | null
}

export interface SummaryResponse {
  current_sprint: CurrentSprint | null
  comparison_to_last_sprint: {
    direction: 'up' | 'down' | 'same'
    difference: number
  } | null
  trend: SprintTrend[]
  top_source_channels: SourceChannel[]
  top_engineers_adhoc_load: EngineerLoad[]
}

export interface Sprint {
  sprint_id: string
  sprint_name: string
  state: string
  start_date: string | null
  end_date: string | null
  adhoc_count: number
  planned_count: number
  adhoc_percentage: number
  total_story_points_adhoc: number
  total_story_points_planned: number
}

export interface SprintsResponse {
  sprints: Sprint[]
}

export interface Engineer {
  engineer_slack_id: string
  engineer_name: string
  adhoc_tickets: number
  adhoc_points: number
}

export interface EngineersResponse {
  engineers: Engineer[]
}

export interface Channel {
  channel_name: string
  count: number
}

export interface ChannelsResponse {
  channels: Channel[]
}

export interface AgentDecision {
  id: string
  ticket_id: string | null
  detected_task_id: string | null
  action: string
  confidence: number
  reasoning: string
  assignee_name: string | null
  assignee_reason: string | null
  jira_ticket_id: string | null
  channel_name: string
  story_points: number | null
  estimated_hours: number | null
  auto_approved: boolean
  created_at: string
}
