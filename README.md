# Strafe — Sprint Intelligence

Strafe automatically detects ad-hoc work from Slack, classifies it using Claude AI, and gives engineering teams visibility into how much unplanned work is disrupting their sprints.

## What it does

- **Monitors Slack channels** for threads that contain actionable work (bugs, feature requests, tasks)
- **Classifies threads with Claude** — determines if a conversation is a task, bug, feature request, or just noise
- **Generates Jira tickets** automatically and adds them to the active sprint
- **Tracks sprint health** — shows what percentage of sprint work was planned vs. dropped in from Slack
- **Assigns tickets** to the right engineer based on expertise (PR history per service/domain)
- **Dashboard** — visualizes adhoc trends, top source channels, and engineer load across sprints

---

## Architecture

```
Slack ──► FastAPI Backend ──► Claude AI (classification)
                │                      │
                ▼                      ▼
           PostgreSQL ◄──── Jira (ticket creation)
                │
                ▼
         Next.js Dashboard
```

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python) |
| Database | PostgreSQL 16 |
| Task Queue | Celery + Redis |
| AI Classification | Claude (claude-sonnet-4) |
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Charts | Recharts |
| Integrations | Slack API, Jira REST API, GitHub API |

---

## Project Structure

```
strafe/
├── app/
│   ├── api/               # FastAPI route handlers
│   │   ├── analytics.py   # Sprint/channel/engineer analytics endpoints
│   │   ├── tickets.py     # Ticket CRUD + approve/reject
│   │   ├── slack_events.py# Slack event webhook handler
│   │   ├── jira_events.py # Jira webhook handler
│   │   ├── channels.py    # Channel config management
│   │   └── tasks.py       # Detected task endpoints
│   ├── models/            # SQLAlchemy ORM models
│   ├── services/
│   │   ├── claude_classifier.py  # AI thread classification
│   │   ├── ticket_generator.py   # Ticket generation logic
│   │   ├── jira_client.py        # Jira API client
│   │   ├── slack_client.py       # Slack API client
│   │   ├── thread_analyzer.py    # Slack thread analysis
│   │   └── classification_service.py # Analytics aggregations
│   ├── workers/           # Celery background tasks
│   ├── config.py          # Settings (loaded from .env)
│   ├── database.py        # SQLAlchemy engine + session
│   └── main.py            # FastAPI app entry point
├── dashboard/             # Next.js frontend
│   ├── app/
│   │   ├── page.tsx       # Main dashboard
│   │   ├── tickets/       # Ticket management table
│   │   ├── sprints/       # Sprint history cards
│   │   ├── channels/      # Channel breakdown + pie chart
│   │   └── engineers/     # Engineer adhoc load grid
│   ├── components/        # Shared React components
│   └── lib/               # Hooks, utils, types, API client
├── scripts/
│   ├── seed_demo.py       # Demo dataset 1
│   └── seed_demo_2.py     # Demo dataset 2
├── alembic/               # Database migrations
├── docker-compose.yml     # PostgreSQL + Redis
└── requirements.txt
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker Desktop

### 1. Clone and configure

```bash
git clone <repo-url>
cd strafe
```

Create a `.env` file in the project root:

```env
# Database & Redis
DATABASE_URL=postgresql+asyncpg://strafe:strafe@localhost:5432/strafe
REDIS_URL=redis://localhost:6379/0

# Slack — from api.slack.com/apps
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# Anthropic — from console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Jira (optional)
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=...
JIRA_BASE_URL=https://yourworkspace.atlassian.net
JIRA_PROJECT_KEY=ENG

# GitHub (optional — for expertise scoring)
GITHUB_TOKEN=github_pat_...

DEBUG=true
```

### 2. Start infrastructure

```bash
docker compose up -d
```

### 3. Install Python dependencies

```bash
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # Mac/Linux

pip install -r requirements.txt
```

### 4. Run database migrations

```bash
alembic upgrade head
```

### 5. Seed demo data

```bash
# Dataset 1 — backend/sales-eng channels, engineers: Maya, Alex, Jordan, Sam
python -m scripts.seed_demo

# Dataset 2 — platform/customer-success channels, engineers: Priya, Daniel, Rachel, Marco
python -m scripts.seed_demo_2
```

### 6. Start the backend

```bash
python -m uvicorn app.main:app --port 5000
```

API docs available at `http://localhost:5000/docs`

### 7. Start the frontend

```bash
cd dashboard
npm install
npm run dev
```

Dashboard available at `http://localhost:3000`

### 8. (Optional) Start Celery worker

Required for background Slack event processing:

```bash
celery -A app.workers.celery_app worker --loglevel=info
```

---

## API Endpoints

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics/summary` | Full dashboard summary (all-in-one) |
| GET | `/analytics/sprints` | List sprints with breakdown |
| GET | `/analytics/trend` | Adhoc % trend across N sprints |
| GET | `/analytics/channels` | Tickets by source channel |
| GET | `/analytics/engineers` | Engineer adhoc load rankings |

### Tickets
| Method | Endpoint | Description |
|---|---|---|
| GET | `/tickets/` | List tickets (filterable by status) |
| GET | `/tickets/{id}` | Get single ticket |
| PATCH | `/tickets/{id}` | Update draft ticket |
| POST | `/tickets/{id}/approve` | Approve → creates Jira ticket |
| POST | `/tickets/{id}/reject` | Reject with optional reason |

### Slack
| Method | Endpoint | Description |
|---|---|---|
| POST | `/slack/events` | Slack event webhook receiver |

### Jira
| Method | Endpoint | Description |
|---|---|---|
| POST | `/webhooks/jira` | Jira webhook receiver (sprint sync) |

---

## How Classification Works

When a Slack thread meets the monitoring threshold (reply count ≥ `min_replies`):

1. Thread content is fetched via Slack API
2. Claude analyzes the thread and returns a classification:
   - `task` / `bug` / `feature_request` → actionable, ticket generated
   - `question` / `conversation` → ignored
3. If actionable, the system:
   - Looks up the best-match engineer via expertise scores (PR history)
   - Generates a structured Jira ticket draft
   - Optionally auto-creates the ticket in Jira and adds it to the active sprint

---

## Dashboard Pages

| Page | URL | Description |
|---|---|---|
| Dashboard | `/` | Adhoc trend chart, top channels, engineer load, recent tickets |
| Tickets | `/tickets` | Full ticket table with filters and detail panel |
| Sprints | `/sprints` | Sprint cards with adhoc/planned breakdown |
| Channels | `/channels` | Pie chart + table of tickets by Slack channel |
| Engineers | `/engineers` | Engineer cards ranked by adhoc workload |
