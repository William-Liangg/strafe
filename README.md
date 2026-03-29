# Strafe

**Sprint Intelligence for Engineering Teams**

Strafe automatically detects ad-hoc work requests from Slack conversations, generates structured Jira tickets using Claude AI, suggests optimal assignees based on GitHub contribution history, and provides analytics on sprint health and team workload distribution. It transforms scattered Slack requests into trackable tickets—giving engineering managers visibility into how much unplanned work is disrupting their sprints.

## Features

### Core Workflow
- **Slack Thread Detection** — Monitors channels for threads with replies, auto-triggers Claude analysis
- **AI Classification** — Classifies threads as task/bug/feature_request/question/conversation with confidence scores
- **Ticket Generation** — Generates complete Jira tickets (title, description, priority, story points, labels)
- **Smart Assignment** — Suggests assignees based on GitHub PR history and expertise domains
- **Jira Integration** — Creates real Jira tickets on approval, auto-adds to active sprint
- **Slack Notifications** — DMs assignees when tickets are created

### Triggers
- **Automatic** — Thread replies in monitored channels
- **Slash Command** — `/strafe log <thread_url>` from any channel
- **Emoji Reaction** — React with ⚡ to any message

### Analytics
- **Sprint Breakdown** — Adhoc vs planned work percentage per sprint
- **Engineer Workload** — Per-engineer adhoc load tracking with trends
- **Channel Analysis** — Top source channels for adhoc work
- **Expertise Graph** — D3 visualization of team expertise domains

### Dashboard
- **Live Feed** — Real-time view of detected threads and pending approvals
- **Ticket Management** — Approve/reject/edit ticket drafts
- **Sprint Analytics** — Visual breakdown of sprint health
- **Expertise Map** — Interactive graph of team knowledge domains

## Tech Stack

### Backend
| Component | Technology |
|-----------|------------|
| Framework | FastAPI (Python 3.11+) |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL (asyncpg) |
| Migrations | Alembic |
| Task Queue | Celery + Redis |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |

### Frontend
| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Data Fetching | SWR |
| Visualization | D3.js, Recharts |
| Icons | Lucide React |

### Integrations
| Service | Purpose |
|---------|---------|
| Slack | Event webhooks, message fetching, DMs |
| Jira | Ticket creation, sprint management |
| GitHub | Contributor analysis for expertise mapping |
| Google Calendar | (Partial) Availability checking |

## Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 1. Clone and Install Dependencies

```bash
git clone <repo-url>
cd strafe

# Backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Frontend
cd dashboard
npm install
cd ..
```

### 2. Set Up Database

```bash
# Create PostgreSQL database
createdb strafe

# Or with psql
psql -c "CREATE DATABASE strafe;"
psql -c "CREATE USER strafe WITH PASSWORD 'strafe';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE strafe TO strafe;"
```

### 3. Configure Environment

Create `.env` in project root:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://strafe:strafe@localhost:5432/strafe

# Redis
REDIS_URL=redis://localhost:6379/0

# Slack (from api.slack.com/apps)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-random-secret

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-api-key

# Jira (from id.atlassian.com/manage-profile/security/api-tokens)
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_BASE_URL=https://yourworkspace.atlassian.net
JIRA_PROJECT_KEY=ENG
JIRA_BOARD_ID=1

# GitHub
GITHUB_TOKEN=ghp_your-personal-access-token
GITHUB_REPO_OWNER=your-org
GITHUB_REPO_NAME=your-repo

# Google Calendar (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Debug
DEBUG=true
```

### 4. Run Migrations

```bash
alembic upgrade head
```

### 5. (Optional) Seed Demo Data

```bash
python -m scripts.seed_demo
```

### 6. Start Services

```bash
# Terminal 1: Backend API
uvicorn app.main:app --reload --port 8000

# Terminal 2: Celery Worker
celery -A app.workers.celery_app worker --loglevel=info

# Terminal 3: Frontend
cd dashboard && npm run dev
```

### 7. Configure Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create new app or select existing
3. **OAuth & Permissions** → Add Bot Token Scopes:
   - `channels:read`, `channels:history`
   - `groups:read`, `groups:history`
   - `chat:write`
   - `users:read`
   - `reactions:read`
   - `commands`
   - `app_mentions:read`
4. **Event Subscriptions** → Enable and set Request URL:
   - `https://your-ngrok-url.ngrok.io/slack/events`
5. Subscribe to bot events:
   - `message.channels`, `message.groups`
   - `reaction_added`
   - `app_mention`
6. **Slash Commands** → Create `/strafe` pointing to:
   - `https://your-ngrok-url.ngrok.io/slack/commands`
7. Install to workspace and copy Bot Token to `.env`

### 8. Access Dashboard

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables Reference

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | Your database setup |
| `REDIS_URL` | Yes | Redis connection string | Your Redis setup |
| `SLACK_BOT_TOKEN` | Yes | Bot user OAuth token (xoxb-...) | Slack App → OAuth & Permissions |
| `SLACK_SIGNING_SECRET` | Yes | Request signature verification | Slack App → Basic Information |
| `SLACK_CLIENT_ID` | Yes | OAuth app client ID | Slack App → Basic Information |
| `SLACK_CLIENT_SECRET` | Yes | OAuth app client secret | Slack App → Basic Information |
| `NEXTAUTH_URL` | Yes | Frontend URL for auth callbacks | Your deployment URL |
| `NEXTAUTH_SECRET` | Yes | Session encryption key | `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | Yes | Claude API key | console.anthropic.com |
| `JIRA_EMAIL` | Yes | Atlassian account email | Your Jira account |
| `JIRA_API_TOKEN` | Yes | Jira API token | id.atlassian.com → Security → API tokens |
| `JIRA_BASE_URL` | Yes | Jira instance URL | `https://yourworkspace.atlassian.net` |
| `JIRA_PROJECT_KEY` | Yes | Project key (e.g., ENG) | Your Jira project |
| `JIRA_BOARD_ID` | Yes | Scrum board ID | URL when viewing board |
| `GITHUB_TOKEN` | No | Personal access token | github.com → Settings → Developer settings |
| `GITHUB_REPO_OWNER` | No | Repository owner | Your repo |
| `GITHUB_REPO_NAME` | No | Repository name | Your repo |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret | Google Cloud Console |
| `DEBUG` | No | Enable debug logging | Set to `true` or `false` |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SLACK WORKSPACE                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                             │
│  │ Message │  │ Reaction│  │ /strafe │                             │
│  │ Events  │  │ Events  │  │ Command │                             │
│  └────┬────┘  └────┬────┘  └────┬────┘                             │
└───────┼────────────┼────────────┼───────────────────────────────────┘
        │            │            │
        ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FASTAPI BACKEND (:8000)                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    /slack/events webhook                      │  │
│  │  • Verify signature                                           │  │
│  │  • Check channel monitoring config                            │  │
│  │  • Enqueue Celery task                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CELERY WORKER + REDIS                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  analyze_and_generate_ticket_task                             │  │
│  │  1. Fetch thread messages from Slack                          │  │
│  │  2. Format for Claude analysis                                │  │
│  │  3. Classify: task/bug/feature/question/conversation          │  │
│  │  4. If actionable + confidence > threshold:                   │  │
│  │     → Generate ticket with Claude                             │  │
│  │     → Query expertise_map for assignee suggestion             │  │
│  │     → Save Ticket (status=draft)                              │  │
│  │     → Log AgentDecision                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL DATABASE                            │
│  tickets | detected_tasks | agent_decisions | expertise_map | ...   │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   NEXT.JS DASHBOARD (:3000)                         │
│  • Live Feed: View draft tickets, approve/reject                    │
│  • On Approve:                                                      │
│    → POST /tickets/{id}/approve                                     │
│    → Create Jira ticket via REST API                                │
│    → Add to active sprint                                           │
│    → Send Slack DM to assignee                                      │
│    → Update ticket status to "created"                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
strafe/
├── app/                          # Backend (FastAPI)
│   ├── main.py                   # App entry + lifespan
│   ├── config.py                 # Settings (pydantic)
│   ├── database.py               # SQLAlchemy setup
│   ├── models/                   # ORM models
│   ├── api/                      # Route handlers
│   ├── services/                 # Business logic
│   └── workers/                  # Celery tasks
├── dashboard/                    # Frontend (Next.js)
│   ├── app/                      # Pages (App Router)
│   ├── components/               # React components
│   └── lib/                      # Utilities, hooks, API client
├── alembic/                      # Database migrations
├── scripts/                      # Utility scripts
├── requirements.txt              # Python dependencies
├── docker-compose.yml            # Local dev services
└── README.md                     # This file
```

## API Documentation

Once running, view interactive API docs at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## License

MIT
