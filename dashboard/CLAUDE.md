# Strafe - Sprint Intelligence Platform

## Overview

Strafe is a Sprint Intelligence platform that automatically detects ad-hoc work from Slack conversations, generates structured Jira tickets, and provides analytics on sprint health and team workload distribution.

## Architecture

### Backend (Python/FastAPI)
Located in `/app/`

- **Framework**: FastAPI with SQLAlchemy ORM
- **Database**: PostgreSQL with Alembic migrations
- **Task Queue**: Celery with Redis
- **AI**: Claude API for ticket classification and generation

### Frontend (Next.js)
Located in `/dashboard/`

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS with custom light theme
- **Data Fetching**: SWR for real-time updates
- **Visualization**: D3.js for expertise graph

## Key Features

### 1. Ticket Management (`/tickets`)
- View all tickets with filtering by status (Draft, Approved, Rejected)
- Search functionality
- **Relationship grouping**: Related tickets are visually grouped with parent tickets
- Ticket detail panel for viewing/editing
- Jira integration for creating real tickets

### 2. Expertise Map (`/expertise`)
- D3 force-directed graph showing team expertise
- GitHub sync to analyze contributor domains
- Interactive node selection and filtering
- Contributor cards with domain strength indicators
- Real-time sync status tracking

### 3. Sprint Analytics (`/sprints`)
- Sprint-by-sprint breakdown of ad-hoc vs planned work
- Trend visualization
- Story point tracking

### 4. Engineer Workload (`/engineers`)
- Per-engineer ad-hoc load tracking
- Team statistics
- Trend indicators (up/down/flat)

### 5. Live Feed (`/` - Dashboard home)
- Real-time agent decisions feed
- Quick stats overview
- Source channel breakdown

## Project Structure

```
strafe/
├── app/                          # Backend
│   ├── api/                      # FastAPI routes
│   │   ├── tickets.py            # Ticket CRUD endpoints
│   │   ├── analytics.py          # Sprint/engineer analytics
│   │   ├── expertise.py          # Expertise graph endpoints
│   │   ├── integrations.py       # Jira/GitHub/GCal status
│   │   ├── agent.py              # Agent decisions
│   │   └── slack_events.py       # Slack webhook handlers
│   ├── models/                   # SQLAlchemy models
│   │   ├── ticket.py
│   │   ├── expertise_map.py
│   │   ├── agent_decision.py
│   │   └── ...
│   ├── services/                 # Business logic
│   │   ├── ticket_generator.py   # Claude-powered ticket generation
│   │   ├── github_analyzer.py    # GitHub expertise analysis
│   │   ├── jira_client.py        # Jira API integration
│   │   └── ...
│   ├── workers/                  # Celery tasks
│   │   └── tasks.py              # Async background jobs
│   └── main.py                   # FastAPI app entrypoint
│
└── dashboard/                    # Frontend
    ├── app/
    │   ├── layout.tsx            # Root layout (fonts, body)
    │   ├── (dashboard)/          # Dashboard route group
    │   │   ├── layout.tsx        # Sidebar layout
    │   │   ├── page.tsx          # Live Feed (home)
    │   │   ├── tickets/page.tsx  # Ticket management
    │   │   ├── sprints/page.tsx  # Sprint analytics
    │   │   ├── engineers/page.tsx # Engineer workload
    │   │   └── expertise/page.tsx # Expertise map
    │   └── (auth)/               # Auth route group
    │       └── login/page.tsx
    ├── components/
    │   ├── Sidebar.tsx           # Navigation sidebar
    │   ├── TicketDetailPanel.tsx # Ticket view/edit panel
    │   ├── IntegrationsModal.tsx # Jira/GitHub/GCal setup
    │   └── ...
    └── lib/
        ├── api.ts                # API client functions
        ├── hooks.ts              # SWR data hooks
        ├── types.ts              # TypeScript interfaces
        ├── user.ts               # Current user config
        └── utils.ts              # Utilities (cn helper)
```

## Design System

### Theme: Light/Natural
- **Background**: `#f9faf0` (warm off-white)
- **Card Background**: `#ffffff`
- **Primary Text**: `#2d3526` (dark olive)
- **Secondary Text**: `#757d6b` (muted olive)
- **Accent Green**: `#3a6b4a`
- **Accent Amber**: `#a07842`
- **Accent Red**: `#9f403d`
- **Border/Divider**: `#b8c4a8` at 30% opacity

### Typography
- **Headings**: Manrope (variable font)
- **Body**: Inter (variable font)
- **Monospace**: System mono for IDs/codes

### Components
- **Cards**: `rounded-3xl` with subtle shadows
- **Buttons**: `rounded-2xl` with gradient backgrounds
- **Pills/Badges**: `rounded-full` or `rounded-xl`
- **Status Indicators**: Small colored pips (1.5-2px dots)

## Key Types

```typescript
interface Ticket {
  id: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'draft' | 'approved' | 'rejected' | 'created'
  story_points: number
  estimated_hours: number | null
  labels: string[]
  origin_type: 'adhoc' | 'planned'
  trigger_mode: 'automatic' | 'slash_command' | 'emoji' | 'manual'
  source_channel_name: string | null
  suggested_assignee_name: string | null
  related_ticket_id: string | null  // For ticket relationships
  jira_ticket_id: string | null
  jira_ticket_url: string | null
  created_at: string
}

interface ExpertiseNode {
  id: string
  name: string
  github_login: string
  avatar_url: string | null
  expertise: { domain: string; score: number }[]
  top_domain: string
}

interface Engineer {
  engineer_slack_id: string
  engineer_name: string
  adhoc_tickets: number
  adhoc_points: number
  adhoc_percentage: number
  planned_tickets: number
  planned_points: number
  trend: 'up' | 'down' | 'flat'
}
```

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=...
JIRA_API_TOKEN=...
JIRA_PROJECT_KEY=...
GITHUB_REPO_OWNER=...
GITHUB_REPO_NAME=...
GITHUB_TOKEN=ghp_...
ANTHROPIC_API_KEY=sk-ant-...
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Session Work Summary

This session focused on:

1. **Layout Structure Fix**: Corrected Next.js App Router layout hierarchy - root layout has `<html>/<body>`, route group layouts do not

2. **Merge Conflict Resolution**: Resolved conflicts in tickets page keeping:
   - Grouping logic from feature branch (related ticket support)
   - Light theme styling from HEAD

3. **Missing Exports**: Restored missing functions in `lib/api.ts` and `lib/hooks.ts`:
   - `disconnectIntegration`, `getIntegrationConnectUrl`, `triggerExpertiseSync`
   - `useExpertiseGraph`, `useExpertiseSyncStatus`, `useIntegrationStatus`

4. **TypeScript Fixes**: Fixed implicit `any` types in expertise page useMemo callbacks

## Running the Project

```bash
# Backend
cd app
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Celery worker (separate terminal)
celery -A app.workers.celery_app worker --loglevel=info

# Frontend
cd dashboard
npm install
npm run dev
```

## Notes

- The expertise sync requires valid GitHub credentials to analyze repository contributors
- Celery tasks use synchronous SQLAlchemy sessions for database updates to avoid asyncpg conflicts
- SWR hooks have varying refresh intervals based on data freshness requirements
