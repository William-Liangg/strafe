import type {
  AgentDecisionsResponse,
  AgentStatusResponse,
  ChannelsResponse,
  DisconnectResponse,
  EngineersResponse,
  ExpertiseGraphResponse,
  ExpertiseSyncStatus,
  ExpertiseSyncTriggerResponse,
  IntegrationStatusResponse,
  SummaryResponse,
  SprintBreakdown,
  SprintsResponse,
  Ticket,
  TicketApproveResponse,
  TicketListResponse,
  TicketPriority,
  TicketStatus,
  TriggerMode,
} from '@/lib/types'

type DemoTask = {
  id: string
  classification: string
  confidence: number
  title: string
  description: string
  priority: TicketPriority
  status: string
  created_at: string
  thread: {
    thread_ts: string
    channel_id: string
    reply_count: number
  }
}

type DemoChannelConfig = {
  channel_id: string
  channel_name: string
  workspace_id: string
  sensitivity: number
  monitoring_active: boolean
  min_replies: number
}

type DemoTicketInput = {
  id: string
  detectedTaskId?: string | null
  jiraTicketId: string | null
  title: string
  description: string
  priority: TicketPriority
  labels: string[]
  storyPoints: number
  suggestedAssigneeSlackId?: string | null
  suggestedAssigneeName?: string | null
  assigneeReason?: string | null
  sourceChannelId?: string | null
  sourceChannelName?: string | null
  sourceThreadTs?: string | null
  originType: 'adhoc' | 'planned'
  triggerMode: TriggerMode
  status: TicketStatus
  createdHoursAgo?: number
  updatedHoursAgo?: number
}

export type DemoState = {
  tasks: DemoTask[]
  ticketList: TicketListResponse
  summary: SummaryResponse
  trend: {
    trend: SummaryResponse['trend']
    num_sprints: number
  }
  analyticsChannels: ChannelsResponse
  engineers: EngineersResponse
  sprints: SprintsResponse
  channelConfigs: DemoChannelConfig[]
  agentStatus: AgentStatusResponse
  agentDecisions: AgentDecisionsResponse
  integrations: IntegrationStatusResponse
  expertiseGraph: ExpertiseGraphResponse
  expertiseSyncStatus: ExpertiseSyncStatus
}

const TWELVE_HOURS = 12

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function slackPermalink(channelName: string, threadTs: string): string {
  return `https://slack.com/app_redirect?channel=${channelName.replace(/^#/, '')}&message_ts=${threadTs}`
}

function makeTicket({
  id,
  detectedTaskId = null,
  jiraTicketId,
  title,
  description,
  priority,
  labels,
  storyPoints,
  suggestedAssigneeSlackId = null,
  suggestedAssigneeName = null,
  assigneeReason = null,
  sourceChannelId = null,
  sourceChannelName = null,
  sourceThreadTs = null,
  originType,
  triggerMode,
  status,
  createdHoursAgo = TWELVE_HOURS,
  updatedHoursAgo = createdHoursAgo,
}: DemoTicketInput): Ticket {
  return {
    id,
    detected_task_id: detectedTaskId,
    jira_ticket_id: jiraTicketId,
    jira_ticket_url: jiraTicketId ? `https://yourworkspace.atlassian.net/browse/${jiraTicketId}` : null,
    title,
    description,
    priority,
    labels,
    story_points: storyPoints,
    suggested_assignee_slack_id: suggestedAssigneeSlackId,
    suggested_assignee_name: suggestedAssigneeName,
    assignee_reason: assigneeReason,
    source_thread_url:
      sourceChannelName && sourceThreadTs
        ? slackPermalink(sourceChannelName, sourceThreadTs)
        : null,
    source_channel_id: sourceChannelId,
    source_channel_name: sourceChannelName,
    source_thread_ts: sourceThreadTs,
    origin_type: originType,
    trigger_mode: triggerMode,
    status,
    rejection_reason: null,
    created_at: isoHoursAgo(createdHoursAgo),
    updated_at: isoHoursAgo(updatedHoursAgo),
  }
}

function buildTickets(): Ticket[] {
  return [
    makeTicket({
      id: 'ticket-eng-41',
      detectedTaskId: 'task-orders-pagination',
      jiraTicketId: 'ENG-41',
      title: 'Fix pagination returning duplicate results on /orders',
      description:
        '## Summary\nPagination on orders endpoint returns duplicate items at page boundaries.\n\n## Acceptance Criteria\n- Offset-based pagination returns unique items\n- Regression test added',
      priority: 'high',
      labels: ['adhoc', 'bug'],
      storyPoints: 3,
      suggestedAssigneeSlackId: 'U_ALEX_CHEN',
      suggestedAssigneeName: 'Alex Chen',
      assigneeReason: '12 PRs on orders-service in last 90 days',
      sourceChannelId: 'C_SALES_ENG',
      sourceChannelName: '#sales-engineering',
      sourceThreadTs: '1711000002.000002',
      originType: 'adhoc',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-42',
      detectedTaskId: 'task-quotes-discount-code',
      jiraTicketId: 'ENG-42',
      title: 'Add discount_code field to sales quotes response',
      description:
        '## Summary\nSales needs discount_code visible in quotes response for deal tracking.\n\n## Acceptance Criteria\n- discount_code field added to /v2/quotes response\n- Field is nullable when no discount applied',
      priority: 'medium',
      labels: ['adhoc', 'feature'],
      storyPoints: 2,
      suggestedAssigneeSlackId: 'U_MAYA_PATEL',
      suggestedAssigneeName: 'Maya Patel',
      assigneeReason: '8 PRs on quotes-service in last 90 days',
      sourceChannelId: 'C_SALES_ENG',
      sourceChannelName: '#sales-engineering',
      sourceThreadTs: '1711000003.000003',
      originType: 'adhoc',
      triggerMode: 'slash_command',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-43',
      detectedTaskId: 'task-mobile-auth-tokens',
      jiraTicketId: 'ENG-43',
      title: 'Auth tokens expiring early on mobile clients',
      description:
        '## Summary\nMobile users reporting frequent logouts. Token TTL appears misconfigured after last auth-service deploy.\n\n## Acceptance Criteria\n- Token TTL matches documented 7-day value\n- Mobile regression test passes',
      priority: 'critical',
      labels: ['adhoc', 'bug'],
      storyPoints: 3,
      suggestedAssigneeSlackId: 'U_JORDAN_LEE',
      suggestedAssigneeName: 'Jordan Lee',
      assigneeReason: '15 PRs on auth-service in last 90 days',
      sourceChannelId: 'C_DEVOPS_REQUESTS',
      sourceChannelName: '#devops-requests',
      sourceThreadTs: '1711000004.000004',
      originType: 'adhoc',
      triggerMode: 'emoji_reaction',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-28',
      jiraTicketId: 'ENG-28',
      title: 'Add rate limiting to public API endpoints',
      description:
        '## Summary\nCustomer reported API abuse. Need rate limiting on public endpoints.',
      priority: 'high',
      labels: ['adhoc', 'security'],
      storyPoints: 3,
      suggestedAssigneeSlackId: 'U_JORDAN_LEE',
      suggestedAssigneeName: 'Jordan Lee',
      sourceChannelId: 'C_BACKEND_HELP',
      sourceChannelName: '#backend-help',
      originType: 'adhoc',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-29',
      jiraTicketId: 'ENG-29',
      title: 'Fix memory leak in websocket connections',
      description:
        '## Summary\nProd servers OOMing after 48hrs. WebSocket connections not cleaning up.',
      priority: 'high',
      labels: ['adhoc', 'bug'],
      storyPoints: 3,
      suggestedAssigneeSlackId: 'U_ALEX_CHEN',
      suggestedAssigneeName: 'Alex Chen',
      sourceChannelId: 'C_BACKEND_HELP',
      sourceChannelName: '#backend-help',
      originType: 'adhoc',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-30',
      jiraTicketId: 'ENG-30',
      title: 'Add CSV export to analytics dashboard',
      description:
        '## Summary\nFinance team needs CSV exports from analytics for reporting.',
      priority: 'medium',
      labels: ['adhoc', 'feature'],
      storyPoints: 2,
      suggestedAssigneeSlackId: 'U_SAM_WILSON',
      suggestedAssigneeName: 'Sam Wilson',
      sourceChannelId: 'C_BACKEND_HELP',
      sourceChannelName: '#backend-help',
      originType: 'adhoc',
      triggerMode: 'slash_command',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-33',
      jiraTicketId: 'ENG-33',
      title: 'Urgent: Fix SSO login broken for enterprise customers',
      description:
        '## Summary\nEnterprise SSO login returning 500 errors. High priority customer escalation.',
      priority: 'critical',
      labels: ['adhoc', 'bug'],
      storyPoints: 5,
      suggestedAssigneeSlackId: 'U_JORDAN_LEE',
      suggestedAssigneeName: 'Jordan Lee',
      sourceChannelId: 'C_SALES_ENG',
      sourceChannelName: '#sales-engineering',
      originType: 'adhoc',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-34',
      jiraTicketId: 'ENG-34',
      title: 'Add custom field support to quote builder',
      description:
        '## Summary\nSales needs custom fields in quote builder for enterprise deals.',
      priority: 'high',
      labels: ['adhoc', 'feature'],
      storyPoints: 3,
      suggestedAssigneeSlackId: 'U_MAYA_PATEL',
      suggestedAssigneeName: 'Maya Patel',
      sourceChannelId: 'C_SALES_ENG',
      sourceChannelName: '#sales-engineering',
      originType: 'adhoc',
      triggerMode: 'slash_command',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-35',
      jiraTicketId: 'ENG-35',
      title: 'Sales dashboard filter not returning correct results',
      description:
        '## Summary\nSales dashboard filter by region returning wrong data for APAC.',
      priority: 'high',
      labels: ['adhoc', 'bug'],
      storyPoints: 2,
      suggestedAssigneeSlackId: 'U_SAM_WILSON',
      suggestedAssigneeName: 'Sam Wilson',
      sourceChannelId: 'C_SALES_ENG',
      sourceChannelName: '#sales-engineering',
      originType: 'adhoc',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-36',
      jiraTicketId: 'ENG-36',
      title: 'Webhook delivery failures to customer endpoints',
      description:
        '## Summary\nWebhook retries exhausting. Customer integration failing silently.',
      priority: 'medium',
      labels: ['adhoc', 'bug'],
      storyPoints: 2,
      suggestedAssigneeSlackId: 'U_SAM_WILSON',
      suggestedAssigneeName: 'Sam Wilson',
      sourceChannelId: 'C_BACKEND_HELP',
      sourceChannelName: '#backend-help',
      originType: 'adhoc',
      triggerMode: 'emoji_reaction',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-37',
      jiraTicketId: 'ENG-37',
      title: 'Add bulk import for inventory items',
      description:
        '## Summary\nOperations team needs to import 10k+ items. Current UI times out.',
      priority: 'medium',
      labels: ['adhoc', 'feature'],
      storyPoints: 1,
      suggestedAssigneeSlackId: 'U_ALEX_CHEN',
      suggestedAssigneeName: 'Alex Chen',
      sourceChannelId: 'C_BACKEND_HELP',
      sourceChannelName: '#backend-help',
      originType: 'adhoc',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-44',
      jiraTicketId: 'ENG-44',
      title: 'Implement user dashboard redesign',
      description: 'Redesign user dashboard per new Figma specs.',
      priority: 'high',
      labels: ['planned', 'feature'],
      storyPoints: 5,
      suggestedAssigneeSlackId: 'U_MAYA_PATEL',
      suggestedAssigneeName: 'Maya Patel',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-45',
      jiraTicketId: 'ENG-45',
      title: 'Add PostgreSQL read replicas support',
      description: 'Scale read operations with read replica support.',
      priority: 'high',
      labels: ['planned', 'infrastructure'],
      storyPoints: 5,
      suggestedAssigneeSlackId: 'U_ALEX_CHEN',
      suggestedAssigneeName: 'Alex Chen',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-46',
      jiraTicketId: 'ENG-46',
      title: 'Implement OAuth2 PKCE flow for mobile',
      description: 'Add PKCE support for mobile OAuth flow.',
      priority: 'high',
      labels: ['planned', 'security'],
      storyPoints: 3,
      suggestedAssigneeSlackId: 'U_JORDAN_LEE',
      suggestedAssigneeName: 'Jordan Lee',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-47',
      jiraTicketId: 'ENG-47',
      title: 'Build analytics data pipeline v2',
      description: 'Migrate analytics to new event-driven pipeline.',
      priority: 'medium',
      labels: ['planned', 'data'],
      storyPoints: 5,
      suggestedAssigneeSlackId: 'U_SAM_WILSON',
      suggestedAssigneeName: 'Sam Wilson',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-48',
      jiraTicketId: 'ENG-48',
      title: 'Add unit tests for payment service',
      description: 'Increase test coverage for payment service to 80%.',
      priority: 'medium',
      labels: ['planned', 'testing'],
      storyPoints: 3,
      suggestedAssigneeSlackId: 'U_ALEX_CHEN',
      suggestedAssigneeName: 'Alex Chen',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-49',
      jiraTicketId: 'ENG-49',
      title: 'Implement email template system',
      description: 'Build reusable email template system with variables.',
      priority: 'medium',
      labels: ['planned', 'feature'],
      storyPoints: 3,
      suggestedAssigneeSlackId: 'U_MAYA_PATEL',
      suggestedAssigneeName: 'Maya Patel',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-50',
      jiraTicketId: 'ENG-50',
      title: 'Add Datadog APM integration',
      description: 'Integrate Datadog APM for production monitoring.',
      priority: 'medium',
      labels: ['planned', 'observability'],
      storyPoints: 2,
      suggestedAssigneeSlackId: 'U_SAM_WILSON',
      suggestedAssigneeName: 'Sam Wilson',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-51',
      jiraTicketId: 'ENG-51',
      title: 'Migrate to Python 3.12',
      description: 'Upgrade all services to Python 3.12.',
      priority: 'low',
      labels: ['planned', 'maintenance'],
      storyPoints: 2,
      suggestedAssigneeSlackId: 'U_JORDAN_LEE',
      suggestedAssigneeName: 'Jordan Lee',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-52',
      jiraTicketId: 'ENG-52',
      title: 'Document API versioning strategy',
      description: 'Write technical documentation for API versioning.',
      priority: 'low',
      labels: ['planned', 'documentation'],
      storyPoints: 1,
      suggestedAssigneeSlackId: 'U_MAYA_PATEL',
      suggestedAssigneeName: 'Maya Patel',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-53',
      jiraTicketId: 'ENG-53',
      title: 'Implement feature flags service',
      description: 'Build internal feature flags for gradual rollouts.',
      priority: 'high',
      labels: ['planned', 'infrastructure'],
      storyPoints: 3,
      suggestedAssigneeSlackId: 'U_ALEX_CHEN',
      suggestedAssigneeName: 'Alex Chen',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-54',
      jiraTicketId: 'ENG-54',
      title: 'Add GraphQL subscriptions support',
      description: 'Implement real-time GraphQL subscriptions.',
      priority: 'medium',
      labels: ['planned', 'feature'],
      storyPoints: 3,
      suggestedAssigneeSlackId: 'U_SAM_WILSON',
      suggestedAssigneeName: 'Sam Wilson',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-55',
      jiraTicketId: 'ENG-55',
      title: 'Implement retry logic for external APIs',
      description: 'Add exponential backoff retry for third-party API calls.',
      priority: 'medium',
      labels: ['planned', 'reliability'],
      storyPoints: 2,
      suggestedAssigneeSlackId: 'U_JORDAN_LEE',
      suggestedAssigneeName: 'Jordan Lee',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
    makeTicket({
      id: 'ticket-eng-56',
      jiraTicketId: 'ENG-56',
      title: 'Add health check endpoints to all services',
      description: 'Standardize health check endpoints across services.',
      priority: 'low',
      labels: ['planned', 'infrastructure'],
      storyPoints: 2,
      suggestedAssigneeSlackId: 'U_ALEX_CHEN',
      suggestedAssigneeName: 'Alex Chen',
      originType: 'planned',
      triggerMode: 'automatic',
      status: 'created',
    }),
  ]
}

function buildTasks(): DemoTask[] {
  const createdAt = isoHoursAgo(TWELVE_HOURS)

  return [
    {
      id: 'task-orders-pagination',
      classification: 'bug',
      confidence: 0.91,
      title: 'Fix pagination returning duplicate results on /orders',
      description: 'Pagination on orders endpoint returning duplicate items on boundary pages.',
      priority: 'high',
      status: 'converted',
      created_at: createdAt,
      thread: {
        thread_ts: '1711000002.000002',
        channel_id: 'C_SALES_ENG',
        reply_count: 3,
      },
    },
    {
      id: 'task-quotes-discount-code',
      classification: 'feature_request',
      confidence: 0.85,
      title: 'Add discount_code field to sales quotes response',
      description: 'Sales team requesting discount_code field for deal tracking.',
      priority: 'medium',
      status: 'converted',
      created_at: createdAt,
      thread: {
        thread_ts: '1711000003.000003',
        channel_id: 'C_SALES_ENG',
        reply_count: 5,
      },
    },
    {
      id: 'task-mobile-auth-tokens',
      classification: 'bug',
      confidence: 0.94,
      title: 'Auth tokens expiring early on mobile clients',
      description: 'Mobile users reporting frequent logouts. Token TTL misconfigured.',
      priority: 'critical',
      status: 'converted',
      created_at: createdAt,
      thread: {
        thread_ts: '1711000004.000004',
        channel_id: 'C_DEVOPS_REQUESTS',
        reply_count: 6,
      },
    },
  ]
}

function buildAgentDecisions(): AgentDecisionsResponse {
  return {
    total: 8,
    decisions: [
      {
        id: 'decision-003',
        ticket_id: 'ticket-eng-43',
        detected_task_id: 'task-mobile-auth-tokens',
        action: 'auto_assigned',
        confidence: 0.94,
        reasoning:
          'Assigned to Jordan Lee based on 15 PRs on auth-service in the last 90 days. Critical priority. Confidence 94% exceeded the 90% auto-approve threshold.',
        assignee_name: 'Jordan Lee',
        assignee_reason: '15 PRs on auth-service in last 90 days',
        jira_ticket_id: 'ENG-43',
        channel_name: '#devops-requests',
        story_points: 3,
        auto_approved: true,
        created_at: isoHoursAgo(11.5),
      },
      {
        id: 'decision-007',
        ticket_id: null,
        detected_task_id: null,
        action: 'dismissed',
        confidence: 0.61,
        reasoning:
          'Thread classified as a question with 61% confidence, below the 75% detection threshold for #sales-engineering. No ticket generated.',
        assignee_name: null,
        assignee_reason: null,
        jira_ticket_id: null,
        channel_name: '#sales-engineering',
        story_points: null,
        auto_approved: false,
        created_at: isoHoursAgo(11.8),
      },
      {
        id: 'decision-002',
        ticket_id: 'ticket-eng-42',
        detected_task_id: 'task-quotes-discount-code',
        action: 'auto_assigned',
        confidence: 0.88,
        reasoning:
          'Assigned to Maya Patel based on 8 PRs on quotes-service in the last 90 days. Confidence 88% exceeded the 85% auto-approve threshold and 2 story points is within the 3-point auto-approve limit for #backend-help.',
        assignee_name: 'Maya Patel',
        assignee_reason: '8 PRs on quotes-service in last 90 days',
        jira_ticket_id: 'ENG-42',
        channel_name: '#sales-engineering',
        story_points: 2,
        auto_approved: true,
        created_at: isoHoursAgo(12),
      },
      {
        id: 'decision-006',
        ticket_id: null,
        detected_task_id: null,
        action: 'dismissed',
        confidence: 0.23,
        reasoning:
          'Thread classified as general conversation with 23% confidence, below the 60% detection threshold. No ticket generated.',
        assignee_name: null,
        assignee_reason: null,
        jira_ticket_id: null,
        channel_name: '#random',
        story_points: null,
        auto_approved: false,
        created_at: isoHoursAgo(12.2),
      },
      {
        id: 'decision-001',
        ticket_id: 'ticket-eng-41',
        detected_task_id: 'task-orders-pagination',
        action: 'auto_assigned',
        confidence: 0.91,
        reasoning:
          'Assigned to Alex Chen based on 12 PRs on orders-service in the last 90 days. Confidence 91% exceeded the 80% auto-approve threshold and 3 story points is within the 5-point auto-approve limit for #sales-engineering.',
        assignee_name: 'Alex Chen',
        assignee_reason: '12 PRs on orders-service in last 90 days',
        jira_ticket_id: 'ENG-41',
        channel_name: '#sales-engineering',
        story_points: 3,
        auto_approved: true,
        created_at: isoHoursAgo(12.4),
      },
      {
        id: 'decision-004',
        ticket_id: null,
        detected_task_id: null,
        action: 'flagged_for_review',
        confidence: 0.86,
        reasoning:
          'Flagged for manager review because the request is estimated at 8 story points, which exceeds the auto-approve limit of 5. Suggested assignee is Sam Wilson based on reporting-api ownership.',
        assignee_name: 'Sam Wilson',
        assignee_reason: '7 PRs on reporting-api in last 90 days',
        jira_ticket_id: null,
        channel_name: '#backend-help',
        story_points: 8,
        auto_approved: false,
        created_at: isoHoursAgo(14),
      },
      {
        id: 'decision-005',
        ticket_id: null,
        detected_task_id: null,
        action: 'flagged_for_review',
        confidence: 0.89,
        reasoning:
          'Flagged for manager review because the request is estimated at 5 story points, which exceeds the auto-approve limit of 3. Suggested assignee is Alex Chen based on recent auth-related PRs.',
        assignee_name: 'Alex Chen',
        assignee_reason: 'Recent auth-related PRs',
        jira_ticket_id: null,
        channel_name: '#devops-requests',
        story_points: 5,
        auto_approved: false,
        created_at: isoHoursAgo(16),
      },
      {
        id: 'decision-008',
        ticket_id: null,
        detected_task_id: null,
        action: 'pattern_matched',
        confidence: 0.95,
        reasoning:
          'Recurring pattern detected: the sales team has requested data exposure on the quotes endpoint three times in six weeks. Pattern flagged for manager awareness.',
        assignee_name: 'Maya Patel',
        assignee_reason: 'Primary quotes-service owner',
        jira_ticket_id: null,
        channel_name: '#sales-engineering',
        story_points: null,
        auto_approved: false,
        created_at: isoHoursAgo(20),
      },
    ],
  }
}

function buildCurrentSprint(): SprintBreakdown {
  return {
    sprint_id: 'sprint-14',
    sprint_name: 'Sprint 14',
    state: 'active',
    start_date: isoDaysFromNow(-7),
    end_date: isoDaysFromNow(7),
    adhoc_count: 3,
    planned_count: 13,
    total_count: 16,
    adhoc_percentage: 18.8,
    planned_percentage: 81.3,
    total_story_points_adhoc: 8,
    total_story_points_planned: 39,
    total_story_points: 47,
    top_source_channel: '#sales-engineering',
  }
}

export function createDemoState(): DemoState {
  const tickets = buildTickets()
  const currentSprint = buildCurrentSprint()
  const agentDecisions = buildAgentDecisions()

  return {
    tasks: buildTasks(),
    ticketList: {
      tickets,
      total: tickets.length,
    },
    summary: {
      current_sprint: currentSprint,
      trend: [
        {
          sprint_id: 'sprint-12',
          sprint_name: 'Sprint 12',
          adhoc_percentage: 14.3,
          adhoc_count: 3,
          planned_count: 18,
          start_date: isoDaysFromNow(-35),
        },
        {
          sprint_id: 'sprint-13',
          sprint_name: 'Sprint 13',
          adhoc_percentage: 22.7,
          adhoc_count: 5,
          planned_count: 17,
          start_date: isoDaysFromNow(-21),
        },
        {
          sprint_id: 'sprint-14',
          sprint_name: 'Sprint 14',
          adhoc_percentage: 23.5,
          adhoc_count: 4,
          planned_count: 13,
          start_date: isoDaysFromNow(-7),
        },
      ],
      top_source_channels: [
        {
          channel_name: '#sales-engineering',
          count: 2,
          story_points: 5,
        },
        {
          channel_name: '#devops-requests',
          count: 1,
          story_points: 3,
        },
      ],
      top_engineers_adhoc_load: [
        {
          engineer_name: 'Jordan Lee',
          engineer_slack_id: 'U_JORDAN_LEE',
          adhoc_tickets: 1,
          adhoc_points: 3,
        },
        {
          engineer_name: 'Alex Chen',
          engineer_slack_id: 'U_ALEX_CHEN',
          adhoc_tickets: 1,
          adhoc_points: 3,
        },
        {
          engineer_name: 'Maya Patel',
          engineer_slack_id: 'U_MAYA_PATEL',
          adhoc_tickets: 1,
          adhoc_points: 2,
        },
      ],
      comparison_to_last_sprint: {
        current_percentage: 18.8,
        last_percentage: 22.7,
        difference: -3.9,
        direction: 'down',
        message: 'down 3.9% from last sprint',
      },
      total_adhoc_this_sprint: 3,
    },
    trend: {
      trend: [
        {
          sprint_id: 'sprint-12',
          sprint_name: 'Sprint 12',
          adhoc_percentage: 14.3,
          adhoc_count: 3,
          planned_count: 18,
          start_date: isoDaysFromNow(-35),
        },
        {
          sprint_id: 'sprint-13',
          sprint_name: 'Sprint 13',
          adhoc_percentage: 22.7,
          adhoc_count: 5,
          planned_count: 17,
          start_date: isoDaysFromNow(-21),
        },
        {
          sprint_id: 'sprint-14',
          sprint_name: 'Sprint 14',
          adhoc_percentage: 23.5,
          adhoc_count: 4,
          planned_count: 13,
          start_date: isoDaysFromNow(-7),
        },
      ],
      num_sprints: 3,
    },
    analyticsChannels: {
      channels: [
        {
          channel_name: '#sales-engineering',
          count: 5,
          percentage: 45.5,
        },
        {
          channel_name: '#backend-help',
          count: 5,
          percentage: 45.5,
        },
        {
          channel_name: '#devops-requests',
          count: 1,
          percentage: 9.1,
        },
      ],
      since_days: 90,
    },
    engineers: {
      engineers: [
        {
          engineer_name: 'Jordan Lee',
          engineer_slack_id: 'U_JORDAN_LEE',
          adhoc_tickets: 1,
          adhoc_points: 3,
          planned_tickets: 3,
          planned_points: 7,
          total_points: 10,
          adhoc_percentage: 30,
          top_domain: 'auth-service',
          trend: 'down',
          last_sprint_adhoc_points: 5,
        },
        {
          engineer_name: 'Alex Chen',
          engineer_slack_id: 'U_ALEX_CHEN',
          adhoc_tickets: 1,
          adhoc_points: 3,
          planned_tickets: 4,
          planned_points: 13,
          total_points: 16,
          adhoc_percentage: 18.8,
          top_domain: 'orders-service',
          trend: 'up',
          last_sprint_adhoc_points: 1,
        },
        {
          engineer_name: 'Maya Patel',
          engineer_slack_id: 'U_MAYA_PATEL',
          adhoc_tickets: 1,
          adhoc_points: 2,
          planned_tickets: 3,
          planned_points: 9,
          total_points: 11,
          adhoc_percentage: 18.2,
          top_domain: 'quotes-service',
          trend: 'down',
          last_sprint_adhoc_points: 3,
        },
        {
          engineer_name: 'Sam Wilson',
          engineer_slack_id: 'U_SAM_WILSON',
          adhoc_tickets: 0,
          adhoc_points: 0,
          planned_tickets: 3,
          planned_points: 10,
          total_points: 10,
          adhoc_percentage: 0,
          top_domain: 'analytics-service',
          trend: 'down',
          last_sprint_adhoc_points: 4,
        },
      ],
      team_stats: {
        total_adhoc_points: 8,
        most_impacted_name: 'Jordan Lee',
        most_impacted_points: 3,
        engineers_with_adhoc: 3,
        total_engineers: 4,
        pct_carrying_adhoc: 75,
      },
    },
    sprints: {
      sprints: [
        {
          sprint_id: 'sprint-14',
          sprint_name: 'Sprint 14',
          state: 'active',
          start_date: isoDaysFromNow(-7),
          end_date: isoDaysFromNow(7),
          adhoc_count: 3,
          planned_count: 13,
          total_count: 16,
          adhoc_percentage: 18.8,
          planned_percentage: 81.3,
          total_story_points_adhoc: 8,
          total_story_points_planned: 39,
          total_story_points: 47,
          top_source_channel: '#sales-engineering',
        },
        {
          sprint_id: 'sprint-13',
          sprint_name: 'Sprint 13',
          state: 'closed',
          start_date: isoDaysFromNow(-21),
          end_date: isoDaysFromNow(-7),
          adhoc_count: 5,
          planned_count: 17,
          total_count: 22,
          adhoc_percentage: 22.7,
          planned_percentage: 77.3,
          total_story_points_adhoc: 13,
          total_story_points_planned: 43,
          total_story_points: 56,
          top_source_channel: '#sales-engineering',
        },
        {
          sprint_id: 'sprint-12',
          sprint_name: 'Sprint 12',
          state: 'closed',
          start_date: isoDaysFromNow(-35),
          end_date: isoDaysFromNow(-21),
          adhoc_count: 3,
          planned_count: 18,
          total_count: 21,
          adhoc_percentage: 14.3,
          planned_percentage: 85.7,
          total_story_points_adhoc: 8,
          total_story_points_planned: 54,
          total_story_points: 62,
          top_source_channel: '#backend-help',
        },
      ],
      total: 3,
    },
    channelConfigs: [
      {
        channel_id: 'C_BACKEND_HELP',
        channel_name: '#backend-help',
        workspace_id: 'T_DEMO_WORKSPACE',
        sensitivity: 0.6,
        monitoring_active: true,
        min_replies: 2,
      },
      {
        channel_id: 'C_SALES_ENG',
        channel_name: '#sales-engineering',
        workspace_id: 'T_DEMO_WORKSPACE',
        sensitivity: 0.75,
        monitoring_active: true,
        min_replies: 2,
      },
      {
        channel_id: 'C_DEVOPS_REQUESTS',
        channel_name: '#devops-requests',
        workspace_id: 'T_DEMO_WORKSPACE',
        sensitivity: 0.6,
        monitoring_active: true,
        min_replies: 2,
      },
      {
        channel_id: 'C_RANDOM',
        channel_name: '#random',
        workspace_id: 'T_DEMO_WORKSPACE',
        sensitivity: 0.9,
        monitoring_active: false,
        min_replies: 5,
      },
    ],
    agentStatus: {
      agent_status: 'idle',
      monitored_channels: 3,
      decisions_today: agentDecisions.total,
      auto_assigned_today: 3,
      flagged_for_review_today: 2,
      dismissed_today: 2,
      avg_confidence_today: 0.78,
      last_decision_at: agentDecisions.decisions[0]?.created_at ?? null,
      active_sprint: 'Sprint 14',
      sprint_adhoc_percentage: 18.8,
    },
    agentDecisions,
    integrations: {
      jira: {
        connected: false,
      },
      github: {
        connected: false,
      },
      google_calendar: {
        connected: false,
      },
    },
    expertiseGraph: {
      nodes: [
        {
          id: 'maya-patel',
          name: 'Maya Patel',
          github_login: 'maya-patel',
          avatar_url: null,
          top_domain: 'quotes-service',
          expertise: [
            { domain: 'quotes-service', score: 0.94 },
            { domain: 'pricing-api', score: 0.75 },
          ],
        },
        {
          id: 'alex-chen',
          name: 'Alex Chen',
          github_login: 'alex-chen',
          avatar_url: null,
          top_domain: 'orders-service',
          expertise: [
            { domain: 'orders-service', score: 0.88 },
            { domain: 'inventory-api', score: 0.65 },
          ],
        },
        {
          id: 'jordan-lee',
          name: 'Jordan Lee',
          github_login: 'jordan-lee',
          avatar_url: null,
          top_domain: 'auth-service',
          expertise: [
            { domain: 'auth-service', score: 0.95 },
            { domain: 'user-api', score: 0.7 },
          ],
        },
        {
          id: 'sam-wilson',
          name: 'Sam Wilson',
          github_login: 'sam-wilson',
          avatar_url: null,
          top_domain: 'analytics-service',
          expertise: [
            { domain: 'analytics-service', score: 0.8 },
            { domain: 'reporting-api', score: 0.78 },
          ],
        },
        {
          id: 'ryan-park',
          name: 'Ryan Park',
          github_login: 'ryan-park',
          avatar_url: null,
          top_domain: 'quotes-service',
          expertise: [{ domain: 'quotes-service', score: 0.31 }],
        },
      ],
      edges: [
        {
          source: 'maya-patel',
          target: 'ryan-park',
          shared_domains: ['quotes-service'],
          weight: 0.625,
        },
      ],
    },
    expertiseSyncStatus: {
      status: 'success',
      task_id: 'demo-github-sync',
      started_at: isoHoursAgo(12.5),
      synced_at: isoHoursAgo(12),
      contributors_analyzed: 5,
      domains_extracted: 9,
      error_message: null,
    },
  }
}

export function getDemoTicket(ticketId: string): Ticket | undefined {
  return createDemoState().ticketList.tickets.find((ticket) => ticket.id === ticketId)
}

export function filterDemoDecisions(action?: string, limit?: number): AgentDecisionsResponse {
  const decisions = createDemoState().agentDecisions.decisions
  const filtered = action ? decisions.filter((decision) => decision.action === action) : decisions
  const safeLimit = typeof limit === 'number' && Number.isFinite(limit) ? limit : filtered.length

  return {
    total: filtered.length,
    decisions: filtered.slice(0, safeLimit),
  }
}

export function buildDemoApproveResponse(ticket: Ticket): TicketApproveResponse {
  return {
    id: ticket.id,
    jira_ticket_id: ticket.jira_ticket_id,
    jira_ticket_url: ticket.jira_ticket_url,
    status: ticket.status,
    message: ticket.status === 'created' ? 'Ticket already processed' : 'Ticket was rejected',
  }
}

export function buildDemoDisconnectResponse(service: string): DisconnectResponse {
  const serviceName = service
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

  return {
    success: true,
    message: `Disconnected ${serviceName}`,
  }
}

export function buildDemoExpertiseSyncTrigger(): ExpertiseSyncTriggerResponse {
  return {
    task_id: 'demo-github-sync',
    status: 'running',
  }
}
