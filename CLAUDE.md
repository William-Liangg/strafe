# Strafe - Claude Context Guide

This file provides context for Claude to quickly understand the Strafe codebase.

## What Is Strafe?

Strafe is a Sprint Intelligence platform that:
1. Monitors Slack channels for work requests
2. Uses Claude AI to classify threads and generate Jira tickets
3. Suggests assignees based on GitHub expertise analysis
4. Tracks adhoc vs planned work in sprints
5. Provides analytics dashboards for engineering managers

## Project Structure

```
strafe/
├── app/                              # FastAPI Backend
│   ├── main.py                       # App entry, CORS, lifespan
│   ├── config.py                     # Settings via pydantic-settings
│   ├── database.py                   # SQLAlchemy async setup
│   ├── models/                       # ORM Models
│   │   ├── ticket.py                 # Ticket, TicketStatus, TicketPriority, OriginType, TriggerMode
│   │   ├── detected_task.py          # DetectedTask (classification results)
│   │   ├── slack_thread.py           # SlackThread (analyzed threads)
│   │   ├── agent_decision.py         # AgentDecision, AgentAction enum
│   │   ├── sprint.py                 # Sprint (Jira sprint with metrics)
│   │   ├── expertise_map.py          # ExpertiseMap (engineer domains)
│   │   ├── channel_config.py         # ChannelConfig (monitoring settings)
│   │   ├── github_sync.py            # GithubSync (sync job tracking)
│   │   └── slack_scan.py             # SlackScan (scan job tracking)
│   ├── api/                          # FastAPI Routers
│   │   ├── health.py                 # GET /health
│   │   ├── slack_events.py           # POST /slack/events, /slack/commands
│   │   ├── tasks.py                  # GET/PATCH /tasks/
│   │   ├── channels.py               # GET/POST/PATCH /channels/
│   │   ├── tickets.py                # CRUD + approve/reject /tickets/
│   │   ├── jira_events.py            # POST /webhooks/jira
│   │   ├── analytics.py              # GET /analytics/*
│   │   ├── agent.py                  # GET /agent/decisions, /agent/status
│   │   ├── integrations.py           # GET/POST /integrations/*
│   │   ├── expertise.py              # GET/POST /expertise/*
│   │   └── live_feed.py              # POST /live-feed/bootstrap, scan, channels
│   ├── services/                     # Business Logic
│   │   ├── slack_client.py           # Slack API wrapper
│   │   ├── jira_client.py            # Jira REST API wrapper
│   │   ├── claude_classifier.py      # Thread classification with Claude
│   │   ├── ticket_generator.py       # Ticket generation with Claude
│   │   ├── thread_analyzer.py        # Analysis orchestration
│   │   ├── github_analyzer.py        # GitHub contributor analysis
│   │   ├── live_slack_sync.py        # Live scan orchestration
│   │   └── classification_service.py # Analytics queries
│   └── workers/                      # Celery Tasks
│       ├── celery_app.py             # Celery configuration
│       └── tasks.py                  # All task definitions
├── dashboard/                        # Next.js Frontend
│   ├── app/                          # App Router pages
│   │   ├── (dashboard)/              # Protected routes
│   │   │   ├── page.tsx              # / (Live Feed)
│   │   │   ├── tickets/page.tsx      # /tickets
│   │   │   ├── sprints/page.tsx      # /sprints
│   │   │   ├── engineers/page.tsx    # /engineers
│   │   │   └── expertise/page.tsx    # /expertise
│   │   ├── (auth)/                   # Public routes
│   │   │   └── login/page.tsx        # /login
│   │   └── api/                      # API routes
│   │       ├── auth/                 # Auth callbacks
│   │       ├── proxy/[...path]/      # Backend proxy
│   │       └── demo/                 # Demo data
│   ├── components/                   # React components
│   │   ├── Sidebar.tsx               # Navigation
│   │   ├── TicketDetailPanel.tsx     # Ticket editor
│   │   └── ...
│   └── lib/                          # Utilities
│       ├── api.ts                    # API client functions
│       ├── hooks.ts                  # SWR data hooks
│       ├── types.ts                  # TypeScript interfaces
│       └── session.ts                # Auth session
├── alembic/                          # Migrations
│   └── versions/                     # Migration files
├── scripts/
│   ├── seed_demo.py                  # Seed demo data
│   └── compute_relationships.py      # Ticket relationships
└── requirements.txt                  # Python deps
```

## API Endpoints

### Slack
- `POST /slack/events` — Webhook for message/reaction events
- `POST /slack/commands` — `/strafe log <url>` slash command

### Tickets
- `GET /tickets/` — List tickets (filter: status)
- `GET /tickets/{id}` — Get single ticket
- `PATCH /tickets/{id}` — Update draft ticket
- `POST /tickets/{id}/approve` — Approve → create Jira ticket
- `POST /tickets/{id}/reject` — Reject with reason
- `POST /tickets/tasks/{task_id}/generate` — Trigger generation

### Tasks (Detected)
- `GET /tasks/` — List detected tasks
- `PATCH /tasks/{id}/status` — Update status

### Agent
- `GET /agent/decisions` — Decision log
- `GET /agent/status` — Real-time status

### Analytics
- `GET /analytics/summary` — Full dashboard data
- `GET /analytics/sprints` — Sprint list with metrics
- `GET /analytics/engineers` — Engineer workload
- `GET /analytics/channels` — Channel breakdown
- `GET /analytics/trend` — Adhoc trend

### Expertise
- `GET /expertise/graph` — Nodes + edges for D3
- `POST /expertise/sync` — Trigger GitHub analysis
- `GET /expertise/sync/status` — Check sync status

### Live Feed
- `POST /live-feed/bootstrap` — Clear demo + scan Slack
- `POST /live-feed/scan` — Trigger workspace scan
- `GET /live-feed/scan/status` — Poll scan status
- `POST /live-feed/channels/sync` — Discover bot channels
- `GET /live-feed/channels` — List synced channels

### Integrations
- `GET /integrations/status` — Connection status
- `POST /integrations/disconnect/{service}` — Disconnect

### Webhooks
- `POST /webhooks/jira` — Jira issue/sprint events

## Database Tables

| Table | Purpose |
|-------|---------|
| `tickets` | Core output: title, description, priority, story_points, status, jira_ticket_id, assignee |
| `detected_tasks` | Classification results: classification, confidence, title |
| `slack_threads` | Analyzed threads: thread_ts, channel_id, reply_count |
| `agent_decisions` | Decision log: action, confidence, reasoning |
| `sprints` | Jira sprints: adhoc_count, planned_count, adhoc_percentage |
| `expertise_map` | Engineer domains: engineer_name, service_or_domain, score |
| `channel_configs` | Monitoring settings: sensitivity, min_replies, auto_approve_threshold |
| `github_syncs` | GitHub sync jobs: status, contributors_analyzed |
| `slack_scans` | Slack scan jobs: status, channels_scanned, tickets_generated |

## Celery Tasks

| Task | Trigger | Purpose |
|------|---------|---------|
| `analyze_thread_task` | Message event | Classify thread with Claude |
| `generate_ticket_task` | Slash command / reaction | Generate ticket from thread |
| `analyze_and_generate_ticket_task` | Message event | Combined classify + generate |
| `scan_live_slack_task` | /live-feed/scan | Backfill recent threads |
| `github_sync_task` | /expertise/sync | Analyze GitHub contributors |

Start worker: `celery -A app.workers.celery_app worker --loglevel=info`

## External Integrations

### Slack (app/services/slack_client.py)
- Uses `slack_sdk.WebClient`
- Key methods: `get_thread_messages()`, `send_dm()`, `list_accessible_channels()`
- Env: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`

### Jira (app/services/jira_client.py)
- Uses `httpx` for REST API v3
- Key methods: `create_ticket()`, `get_active_sprint()`, `add_to_sprint()`
- Env: `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_BASE_URL`, `JIRA_PROJECT_KEY`, `JIRA_BOARD_ID`

### Claude (app/services/claude_classifier.py, ticket_generator.py)
- Uses `anthropic` client
- Model: `claude-sonnet-4-20250514`
- Env: `ANTHROPIC_API_KEY`

### GitHub (app/services/github_analyzer.py)
- REST API for contributor/PR analysis
- Env: `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`

## Key Data Flows

### Slack → Ticket
1. Message posted in monitored channel
2. `/slack/events` webhook receives event
3. `analyze_and_generate_ticket_task` enqueued
4. Claude classifies thread
5. If actionable: Claude generates ticket
6. Ticket saved with `status=draft`
7. Dashboard shows in Live Feed
8. User clicks Approve
9. Jira ticket created
10. DM sent to assignee

### GitHub → Expertise Map
1. User triggers `/expertise/sync`
2. `github_sync_task` enqueued
3. Fetch contributors from GitHub
4. For each: analyze PRs with Claude
5. Extract domains (API, Database, etc.)
6. Save to `expertise_map` table
7. Dashboard shows expertise graph

## Demo Mode vs Live Mode

- **Demo mode** (`demo_mode=true` cookie): Shows seeded mock data
- **Live mode**: Shows real Slack data
- Toggle via Sidebar or `/api/demo-toggle`
- `is_mock` flag on tickets, decisions, sprints, expertise

## Known Issues / Incomplete Features

1. **Google Calendar** — OAuth flow exists but availability not used in assignment
2. **Related Tickets** — DB field exists but detection not shown in UI
3. **Estimated Hours** — Generated by Claude but not displayed
4. **RCA / Post-mortem** — Enum values exist but no implementation

## Common Commands

```bash
# Backend
uvicorn app.main:app --reload --port 8000

# Celery
celery -A app.workers.celery_app worker --loglevel=info

# Frontend
cd dashboard && npm run dev

# Migrations
alembic upgrade head
alembic revision -m "description"

# Seed demo
python -m scripts.seed_demo

# Database
psql strafe -c "SELECT * FROM tickets;"
```

## Demo Setup Checklist

1. Start PostgreSQL + Redis
2. Run `alembic upgrade head`
3. Run `python -m scripts.seed_demo` (optional for demo data)
4. Start uvicorn backend
5. Start Celery worker
6. Start Next.js frontend
7. Open http://localhost:3000
8. For live mode: ensure Slack scopes are configured, click "Replace Demo with Slack"

## Environment Variables (Required)

```
DATABASE_URL=postgresql+asyncpg://strafe:strafe@localhost:5432/strafe
REDIS_URL=redis://localhost:6379/0
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
ANTHROPIC_API_KEY=sk-ant-...
JIRA_EMAIL=...
JIRA_API_TOKEN=...
JIRA_BASE_URL=https://yourworkspace.atlassian.net
JIRA_PROJECT_KEY=ENG
JIRA_BOARD_ID=1
```
