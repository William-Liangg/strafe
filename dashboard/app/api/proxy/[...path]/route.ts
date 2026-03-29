import { NextRequest, NextResponse } from 'next/server'

import { createDemoState } from '../../demo/data'
import { getServerEnv } from '../../../../lib/server-env'

export const dynamic = 'force-dynamic'

const BACKEND_BASE_URL =
  getServerEnv('API_BASE_URL') ||
  getServerEnv('NEXT_PUBLIC_API_BASE_URL') ||
  getServerEnv('NEXT_PUBLIC_API_URL') ||
  'http://localhost:8000'

type RouteContext = {
  params: Promise<{
    path: string[]
  }>
}

function getRefererRedirect(request: NextRequest): URL {
  const referer = request.headers.get('referer')
  return referer ? new URL(referer) : new URL('/', request.url)
}

async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function handleDemoRequest(
  request: NextRequest,
  normalizedPath: string,
): Promise<Response | null> {
  const demoState = createDemoState()
  const method = request.method.toUpperCase()

  if (method === 'GET') {
    switch (normalizedPath) {
      case 'tasks':
        return NextResponse.json(demoState.tasks)
      case 'tickets':
        return NextResponse.json(demoState.ticketList)
      case 'analytics/summary':
        return NextResponse.json(demoState.summary)
      case 'analytics/trend': {
        const requestedSprints = Number(request.nextUrl.searchParams.get('num_sprints') ?? demoState.trend.num_sprints)
        const numSprints = Number.isFinite(requestedSprints) && requestedSprints > 0
          ? requestedSprints
          : demoState.trend.num_sprints

        return NextResponse.json({
          trend: demoState.trend.trend.slice(-numSprints),
          num_sprints: numSprints,
        })
      }
      case 'analytics/channels': {
        const sinceDays = Number(request.nextUrl.searchParams.get('since_days') ?? demoState.analyticsChannels.since_days)
        return NextResponse.json({
          ...demoState.analyticsChannels,
          since_days:
            Number.isFinite(sinceDays) && sinceDays > 0
              ? sinceDays
              : demoState.analyticsChannels.since_days,
        })
      }
      case 'analytics/engineers':
        return NextResponse.json(demoState.engineers)
      case 'analytics/sprints':
        return NextResponse.json(demoState.sprints)
      case 'channels':
        return NextResponse.json(demoState.channelConfigs)
      case 'agent/status':
        return NextResponse.json(demoState.agentStatus)
      case 'agent/decisions': {
        const action = request.nextUrl.searchParams.get('action')
        const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? demoState.agentDecisions.decisions.length)
        const filtered = action
          ? demoState.agentDecisions.decisions.filter((decision) => decision.action === action)
          : demoState.agentDecisions.decisions

        return NextResponse.json({
          total: filtered.length,
          decisions: filtered.slice(
            0,
            Number.isFinite(requestedLimit) && requestedLimit > 0
              ? requestedLimit
              : filtered.length,
          ),
        })
      }
      case 'integrations/status':
        return NextResponse.json(demoState.integrations)
      case 'expertise/graph':
        return NextResponse.json(demoState.expertiseGraph)
      case 'expertise/sync/status':
        return NextResponse.json(demoState.expertiseSyncStatus)
      case 'live-feed/scan/status':
        return NextResponse.json({
          status: 'never',
          scan_id: null,
          started_at: null,
          completed_at: null,
          since_hours: 24,
          channels_scanned: 0,
          threads_found: 0,
          tickets_generated: 0,
          error_message: null,
        })
      default:
        break
    }

    if (normalizedPath.startsWith('integrations/connect/')) {
      return NextResponse.redirect(getRefererRedirect(request))
    }
  }

  if (method === 'POST') {
    if (normalizedPath === 'expertise/sync') {
      return NextResponse.json({
        task_id: 'demo-github-sync',
        status: 'running',
      })
    }

    if (normalizedPath.startsWith('integrations/disconnect/')) {
      const service = normalizedPath.split('/')[2] ?? 'integration'
      const serviceName = service
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')

      return NextResponse.json({
        success: true,
        message: `Disconnected ${serviceName}`,
      })
    }

    if (normalizedPath.startsWith('tickets/') && normalizedPath.endsWith('/approve')) {
      const ticketId = normalizedPath.split('/')[1]
      const ticket = demoState.ticketList.tickets.find((entry) => entry.id === ticketId)

      if (!ticket) {
        return NextResponse.json({ detail: 'Ticket not found' }, { status: 404 })
      }

      return NextResponse.json({
        id: ticket.id,
        jira_ticket_id: ticket.jira_ticket_id,
        jira_ticket_url: ticket.jira_ticket_url,
        status: ticket.status,
        message: ticket.status === 'created' ? 'Ticket already processed' : 'Ticket was rejected',
      })
    }

    if (normalizedPath.startsWith('tickets/') && normalizedPath.endsWith('/reject')) {
      const ticketId = normalizedPath.split('/')[1]
      const ticket = demoState.ticketList.tickets.find((entry) => entry.id === ticketId)
      const body = await readJsonBody(request)

      if (!ticket) {
        return NextResponse.json({ detail: 'Ticket not found' }, { status: 404 })
      }

      if (ticket.status !== 'draft') {
        return NextResponse.json(
          { detail: 'Can only reject tickets in draft status' },
          { status: 400 },
        )
      }

      return NextResponse.json({
        ...ticket,
        status: 'rejected',
        rejection_reason:
          typeof body.reason === 'string' && body.reason.trim()
            ? body.reason
            : 'Rejected in demo mode',
        updated_at: new Date().toISOString(),
      })
    }
  }

  if (method === 'PATCH') {
    if (normalizedPath.startsWith('tickets/')) {
      const ticketId = normalizedPath.split('/')[1]
      const ticket = demoState.ticketList.tickets.find((entry) => entry.id === ticketId)
      const body = await readJsonBody(request)

      if (!ticket) {
        return NextResponse.json({ detail: 'Ticket not found' }, { status: 404 })
      }

      if (ticket.status !== 'draft') {
        return NextResponse.json(
          { detail: 'Can only edit tickets in draft status' },
          { status: 400 },
        )
      }

      return NextResponse.json({
        ...ticket,
        ...body,
        updated_at: new Date().toISOString(),
      })
    }

    if (normalizedPath.startsWith('tasks/') && normalizedPath.endsWith('/status')) {
      const taskId = normalizedPath.split('/')[1]
      const body = await readJsonBody(request)
      const statusFromQuery = request.nextUrl.searchParams.get('status')
      const status =
        typeof body.status === 'string'
          ? body.status
          : statusFromQuery ?? 'pending_review'

      return NextResponse.json({
        id: taskId,
        status,
      })
    }
  }

  return null
}

async function forwardToBackend(
  request: NextRequest,
  normalizedPath: string,
): Promise<Response> {
  const backendUrl = `${BACKEND_BASE_URL.replace(/\/$/, '')}/${normalizedPath}${request.nextUrl.search}`
  const headers = new Headers(request.headers)
  headers.delete('host')

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer()

  const response = await fetch(backendUrl, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

async function handleRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params
  const normalizedPath = path.join('/')
  const demoMode = request.cookies.get('demo_mode')?.value === 'true'

  if (demoMode) {
    const demoResponse = await handleDemoRequest(request, normalizedPath)
    if (demoResponse) {
      return demoResponse
    }
  }

  return forwardToBackend(request, normalizedPath)
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleRequest(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleRequest(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleRequest(request, context)
}
