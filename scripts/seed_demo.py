"""
Seed script to populate demo data for Strafe.
Run with: python -m scripts.seed_demo

Demo story flow:
  - Sprint 12 (closed): 14.3% adhoc — the baseline
  - Sprint 13 (closed): 22.7% adhoc — rising trend, #sales-engineering is top source
  - Sprint 14 (active):  3 pre-approved adhoc tickets, NO drafts pending
    → Live demo: post in #backend-help → Strafe detects → draft ticket created
    → Manager approves → Sprint 14 hits 23.5% adhoc (4/17)
  - Agent feed shows 8 historical decisions so the activity feed looks live
"""
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from app.database import async_session, init_db
from app.models import (
    ChannelConfig,
    SlackThread,
    DetectedTask,
    Ticket,
    ExpertiseMap,
    Sprint,
    AgentDecision,
    AgentAction,
)


async def cleanup_database():
    """Clear seeded demo data so the script is safe to rerun."""
    tables = [
        "post_mortems",
        "agent_decisions",
        "tickets",
        "detected_tasks",
        "slack_threads",
        "expertise_map",
        "sprints",
        "channel_configs",
    ]

    async with async_session() as session:
        for table in tables:
            await session.execute(
                text(
                    f"""
                    DO $$
                    BEGIN
                        IF to_regclass('{table}') IS NOT NULL THEN
                            EXECUTE 'TRUNCATE TABLE {table} CASCADE';
                        END IF;
                    END $$;
                    """
                )
            )
        await session.commit()
        print("  Cleared existing demo data")


async def seed_channel_configs():
    """Seed channel configurations for demo with auto-approve settings."""
    configs = [
        {
            "channel_id": "C_BACKEND_HELP",
            "channel_name": "#backend-help",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.6,
            "monitoring_active": True,
            "min_replies": 2,
            "auto_approve_threshold": 0.85,
            "auto_approve_max_points": 3,
            "manager_slack_id": "U_MANAGER",
        },
        {
            "channel_id": "C_SALES_ENG",
            "channel_name": "#sales-engineering",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.75,
            "monitoring_active": True,
            "min_replies": 2,
            "auto_approve_threshold": 0.80,
            "auto_approve_max_points": 5,
            "manager_slack_id": "U_MANAGER",
        },
        {
            "channel_id": "C_DEVOPS_REQUESTS",
            "channel_name": "#devops-requests",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.6,
            "monitoring_active": True,
            "min_replies": 2,
            "auto_approve_threshold": 0.90,
            "auto_approve_max_points": 2,
            "manager_slack_id": "U_MANAGER",
        },
        {
            "channel_id": "C_RANDOM",
            "channel_name": "#random",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.9,
            "monitoring_active": False,
            "min_replies": 5,
            "auto_approve_threshold": 0.95,
            "auto_approve_max_points": 2,
            "manager_slack_id": "U_MANAGER",
        },
    ]

    async with async_session() as session:
        for config_data in configs:
            config = ChannelConfig(**config_data)
            session.add(config)
        await session.commit()
        print(f"  Seeded {len(configs)} channel configs")


async def seed_expertise_map():
    """Seed expertise map. Maya's quotes-service ownership must be clear for the demo."""
    now = datetime.now(timezone.utc)

    experts = [
        # Maya Patel — owns quotes-service (this is why she gets suggested live)
        {
            "engineer_slack_id": "U_MAYA_PATEL",
            "engineer_name": "Maya Patel",
            "service_or_domain": "quotes-service",
            "score": 9.4,
            "pr_count": 8,
            "last_active": now - timedelta(days=6),
        },
        {
            "engineer_slack_id": "U_MAYA_PATEL",
            "engineer_name": "Maya Patel",
            "service_or_domain": "pricing-api",
            "score": 7.5,
            "pr_count": 5,
            "last_active": now - timedelta(days=5),
        },
        # Alex Chen — owns orders-service
        {
            "engineer_slack_id": "U_ALEX_CHEN",
            "engineer_name": "Alex Chen",
            "service_or_domain": "orders-service",
            "score": 8.8,
            "pr_count": 12,
            "last_active": now - timedelta(days=1),
        },
        {
            "engineer_slack_id": "U_ALEX_CHEN",
            "engineer_name": "Alex Chen",
            "service_or_domain": "inventory-api",
            "score": 6.5,
            "pr_count": 4,
            "last_active": now - timedelta(days=8),
        },
        # Jordan Lee — owns auth-service
        {
            "engineer_slack_id": "U_JORDAN_LEE",
            "engineer_name": "Jordan Lee",
            "service_or_domain": "auth-service",
            "score": 9.5,
            "pr_count": 15,
            "last_active": now - timedelta(days=1),
        },
        {
            "engineer_slack_id": "U_JORDAN_LEE",
            "engineer_name": "Jordan Lee",
            "service_or_domain": "user-api",
            "score": 7.0,
            "pr_count": 6,
            "last_active": now - timedelta(days=3),
        },
        # Ryan Park — low score on quotes-service (why he doesn't get picked over Maya)
        {
            "engineer_slack_id": "U_RYAN_PARK",
            "engineer_name": "Ryan Park",
            "service_or_domain": "quotes-service",
            "score": 3.1,
            "pr_count": 1,
            "last_active": now - timedelta(days=21),
        },
        # Sam Wilson — analytics/reporting
        {
            "engineer_slack_id": "U_SAM_WILSON",
            "engineer_name": "Sam Wilson",
            "service_or_domain": "analytics-service",
            "score": 8.0,
            "pr_count": 9,
            "last_active": now - timedelta(days=4),
        },
        {
            "engineer_slack_id": "U_SAM_WILSON",
            "engineer_name": "Sam Wilson",
            "service_or_domain": "reporting-api",
            "score": 7.8,
            "pr_count": 7,
            "last_active": now - timedelta(days=6),
        },
    ]

    async with async_session() as session:
        for expert_data in experts:
            expert = ExpertiseMap(**expert_data)
            session.add(expert)
        await session.commit()
        print(f"  Seeded {len(experts)} expertise map entries")


async def seed_sprints():
    """
    Seed sprint history to match the demo retro story:
      Sprint 12: 14.3% adhoc (3/21) — "14% two sprints ago"
      Sprint 13: 22.7% adhoc (5/22) — "23% last sprint", top source #sales-engineering
      Sprint 14: 23.5% adhoc (4/17) — current sprint, live-computed from tickets
                                        stored fields represent expected post-demo state
    """
    now = datetime.now(timezone.utc)

    sprints_data = [
        {
            "jira_sprint_id": 12,
            "name": "Sprint 12",
            "state": "closed",
            "start_date": now - timedelta(weeks=5),
            "end_date": now - timedelta(weeks=3),
            # 3 adhoc / 21 total = 14.3%
            "adhoc_count": 3,
            "planned_count": 18,
            "adhoc_percentage": 14.3,
            "top_source_channel": "#backend-help",
            "total_story_points_adhoc": 8,
            "total_story_points_planned": 54,
        },
        {
            "jira_sprint_id": 13,
            "name": "Sprint 13",
            "state": "closed",
            "start_date": now - timedelta(weeks=3),
            "end_date": now - timedelta(weeks=1),
            # 5 adhoc / 22 total = 22.7% ≈ "23%"
            "adhoc_count": 5,
            "planned_count": 17,
            "adhoc_percentage": 22.7,
            "top_source_channel": "#sales-engineering",
            "total_story_points_adhoc": 13,
            "total_story_points_planned": 43,
        },
        {
            "jira_sprint_id": 14,
            "name": "Sprint 14",
            "state": "active",
            "start_date": now - timedelta(weeks=1),
            "end_date": now + timedelta(weeks=1),
            # Stored fields represent post-demo state: 4 adhoc / 17 total = 23.5%
            # Active sprint breakdown is computed live from tickets, but trend uses stored.
            "adhoc_count": 4,
            "planned_count": 13,
            "adhoc_percentage": 23.5,
            "top_source_channel": "#sales-engineering",
            "total_story_points_adhoc": 13,
            "total_story_points_planned": 39,
        },
    ]

    async with async_session() as session:
        sprints = []
        for sprint_data in sprints_data:
            sprint = Sprint(**sprint_data)
            session.add(sprint)
            sprints.append(sprint)
        await session.commit()
        print(f"  Seeded {len(sprints)} sprints")
        return sprints


async def seed_historical_tasks_and_tickets():
    """
    Seed historical tickets and the 3 pre-approved Sprint 14 adhoc tickets.

    Sprint 14 starts with NO draft tickets — the dashboard shows
    "Strafe is fully autonomous right now — no pending approvals."
    The live demo creates the 4th adhoc ticket (margin endpoint from #backend-help).
    """
    now = datetime.now(timezone.utc)
    from sqlalchemy import select

    async with async_session() as session:
        sprint_result = await session.execute(select(Sprint))
        sprints = {s.jira_sprint_id: s for s in sprint_result.scalars().all()}
        sprint_12 = sprints.get(12)
        sprint_13 = sprints.get(13)
        sprint_14 = sprints.get(14)

        # ── Sprint 14: 3 pre-approved adhoc tickets (all status=created) ──────────
        # The 4th adhoc ticket (margin endpoint) is created live during the demo.
        # All three are from #sales-engineering so that channel stays top source.
        current_threads = [
            {"thread_ts": "1711000002.000002", "channel_id": "C_SALES_ENG", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 3},
            {"thread_ts": "1711000003.000003", "channel_id": "C_SALES_ENG", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 5},
            {"thread_ts": "1711000004.000004", "channel_id": "C_DEVOPS_REQUESTS", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 6},
        ]

        current_tasks = [
            {
                "classification": "bug",
                "confidence": 0.91,
                "title": "Fix pagination returning duplicate results on /orders",
                "description": "Pagination on orders endpoint returning duplicate items on boundary pages.",
                "priority": "high",
                "status": "converted",
            },
            {
                "classification": "feature_request",
                "confidence": 0.85,
                "title": "Add discount_code field to sales quotes response",
                "description": "Sales team requesting discount_code field for deal tracking.",
                "priority": "medium",
                "status": "converted",
            },
            {
                "classification": "bug",
                "confidence": 0.94,
                "title": "Auth tokens expiring early on mobile clients",
                "description": "Mobile users reporting frequent logouts. Token TTL misconfigured.",
                "priority": "critical",
                "status": "converted",
            },
        ]

        current_tickets = [
            {
                "title": "Fix pagination returning duplicate results on /orders",
                "description": (
                    "## Tasks\n"
                    "- Update offset-based pagination on orders endpoint to handle page boundaries correctly\n"
                    "- Ensure unique items are returned across pages\n"
                    "- Add a regression test to prevent recurrence"
                ),
                "priority": "high",
                "labels": ["adhoc", "bug"],
                "story_points": 3,
                "estimated_hours": 4.5,
                "suggested_assignee_slack_id": "U_ALEX_CHEN",
                "suggested_assignee_name": "Alex Chen",
                "assignee_reason": "12 PRs on orders-service in last 90 days",
                "source_channel_id": "C_SALES_ENG",
                "source_channel_name": "#sales-engineering",
                "source_thread_ts": "1711000002.000002",
                "origin_type": "adhoc",
                "trigger_mode": "automatic",
                "status": "created",
                "jira_ticket_id": "ENG-41",
                "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/ENG-41",
            },
            {
                "title": "Add discount_code field to sales quotes response",
                "description": (
                    "## Tasks\n"
                    "- Add `discount_code` field to the `/v2/quotes` response schema\n"
                    "- Ensure `discount_code` is nullable when no discount is applied\n"
                    "- Confirm tracking requirements are met for the Sales team"
                ),
                "priority": "medium",
                "labels": ["adhoc", "feature"],
                "story_points": 2,
                "estimated_hours": 2.5,
                "suggested_assignee_slack_id": "U_MAYA_PATEL",
                "suggested_assignee_name": "Maya Patel",
                "assignee_reason": "8 PRs on quotes-service in last 90 days",
                "source_channel_id": "C_SALES_ENG",
                "source_channel_name": "#sales-engineering",
                "source_thread_ts": "1711000003.000003",
                "origin_type": "adhoc",
                "trigger_mode": "slash_command",
                "status": "created",
                "jira_ticket_id": "ENG-42",
                "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/ENG-42",
            },
            {
                "title": "Auth tokens expiring early on mobile clients",
                "description": (
                    "## Tasks\n"
                    "- Investigate token TTL misconfiguration after the last auth-service deploy\n"
                    "- Set Token TTL to match the documented 7-day value for mobile clients\n"
                    "- Verify mobile regression tests are passing"
                ),
                "priority": "critical",
                "labels": ["adhoc", "bug"],
                "story_points": 3,
                "estimated_hours": 5.0,
                "suggested_assignee_slack_id": "U_JORDAN_LEE",
                "suggested_assignee_name": "Jordan Lee",
                "assignee_reason": "15 PRs on auth-service in last 90 days",
                "source_channel_id": "C_DEVOPS_REQUESTS",
                "source_channel_name": "#devops-requests",
                "source_thread_ts": "1711000004.000004",
                "origin_type": "adhoc",
                "trigger_mode": "emoji_reaction",
                "status": "created",
                "jira_ticket_id": "ENG-43",
                "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/ENG-43",
            },
        ]

        # ── Sprint 12: 3 adhoc tickets — all from #backend-help ──────────────────
        sprint_12_tickets = [
            {
                "title": "Add rate limiting to public API endpoints",
                "description": "## Tasks\n- Implement rate limiting on public API endpoints to mitigate API abuse\n- Set default limit to 100 requests per minute per IP\n- Add bypass for internal infrastructure monitoring",
                "priority": "high",
                "labels": ["adhoc", "security"],
                "story_points": 3,
                "estimated_hours": 4.5,
                "suggested_assignee_slack_id": "U_JORDAN_LEE",
                "suggested_assignee_name": "Jordan Lee",
                "source_channel_id": "C_BACKEND_HELP",
                "source_channel_name": "#backend-help",
                "origin_type": "adhoc",
                "trigger_mode": "automatic",
                "status": "created",
                "jira_ticket_id": "ENG-28",
                "completed_at": now - timedelta(weeks=3, days=2),
            },
            {
                "title": "Fix memory leak in websocket connections",
                "description": "## Tasks\n- Address WebSocket memory leak causing prod servers to OOM after 48h\n- Investigate connection cleanup logic in `ws_manager.py`\n- Add monitoring alert for memory growth on websocket nodes",
                "priority": "critical",
                "labels": ["adhoc", "bug"],
                "story_points": 3,
                "estimated_hours": 6.0,
                "suggested_assignee_slack_id": "U_ALEX_CHEN",
                "suggested_assignee_name": "Alex Chen",
                "source_channel_id": "C_BACKEND_HELP",
                "source_channel_name": "#backend-help",
                "origin_type": "adhoc",
                "trigger_mode": "automatic",
                "status": "created",
                "jira_ticket_id": "ENG-29",
                "completed_at": now - timedelta(weeks=3, days=4),
            },
            {
                "title": "Add CSV export to analytics dashboard",
                "description": "## Tasks\n- Implement CSV export endpoint/button on analytics dashboard for Finance\n- Ensure all filtered data is included in the export\n- Add timestamp and generator metadata to the filename",
                "priority": "medium",
                "labels": ["adhoc", "feature"],
                "story_points": 2,
                "estimated_hours": 3.0,
                "suggested_assignee_slack_id": "U_SAM_WILSON",
                "suggested_assignee_name": "Sam Wilson",
                "source_channel_id": "C_BACKEND_HELP",
                "source_channel_name": "#backend-help",
                "origin_type": "adhoc",
                "trigger_mode": "slash_command",
                "status": "created",
                "jira_ticket_id": "ENG-30",
                "completed_at": now - timedelta(weeks=3, days=1),
            },
        ]

        # ── Sprint 13: 5 adhoc tickets — 3 from #sales-engineering (top source) ──
        sprint_13_tickets = [
            {
                "title": "Urgent: Fix SSO login broken for enterprise customers",
                "description": "## Tasks\n- Investigate and fix 500 errors preventing Enterprise SSO logins\n- Check SAML assertion parsing logic for recent regression\n- Update logout flow to ensure session invalidation across all nodes",
                "priority": "critical",
                "labels": ["adhoc", "bug"],
                "story_points": 5,
                "estimated_hours": 10.0,
                "suggested_assignee_slack_id": "U_JORDAN_LEE",
                "suggested_assignee_name": "Jordan Lee",
                "source_channel_id": "C_SALES_ENG",
                "source_channel_name": "#sales-engineering",
                "origin_type": "adhoc",
                "trigger_mode": "automatic",
                "status": "created",
                "jira_ticket_id": "ENG-33",
                "completed_at": now - timedelta(weeks=1, days=5),
            },
            {
                "title": "Add custom field support to quote builder",
                "description": "## Tasks\n- Implement custom field functionality in the quote builder\n- Allow users to add arbitrary key-value pairs to quote metadata\n- Ensure custom fields are persisted to the database and reflected in the UI",
                "priority": "high",
                "labels": ["adhoc", "feature"],
                "story_points": 3,
                "estimated_hours": 6.5,
                "suggested_assignee_slack_id": "U_MAYA_PATEL",
                "suggested_assignee_name": "Maya Patel",
                "source_channel_id": "C_SALES_ENG",
                "source_channel_name": "#sales-engineering",
                "origin_type": "adhoc",
                "trigger_mode": "slash_command",
                "status": "created",
                "jira_ticket_id": "ENG-34",
                "completed_at": now - timedelta(weeks=1, days=3),
            },
            {
                "title": "Sales dashboard filter not returning correct results",
                "description": "## Tasks\n- Fix filtering issue where APAC region returns incorrect sales data\n- Verify time zone conversion logic in the sales aggregator\n- Update dashboard query to handle region codes correctly",
                "priority": "high",
                "labels": ["adhoc", "bug"],
                "story_points": 2,
                "estimated_hours": 2.5,
                "suggested_assignee_slack_id": "U_SAM_WILSON",
                "suggested_assignee_name": "Sam Wilson",
                "source_channel_id": "C_SALES_ENG",
                "source_channel_name": "#sales-engineering",
                "origin_type": "adhoc",
                "trigger_mode": "automatic",
                "status": "created",
                "jira_ticket_id": "ENG-35",
                "completed_at": now - timedelta(weeks=1, days=4),
            },
            {
                "title": "Webhook delivery failures to customer endpoints",
                "description": "## Tasks\n- Fix webhook retries exhausting and resolve silent failures for customers\n- Increase max retries to 5 with exponential backoff\n- Implement DLQ (Dead Letter Queue) processing for manual investigation",
                "priority": "medium",
                "labels": ["adhoc", "bug"],
                "story_points": 2,
                "estimated_hours": 4.0,
                "suggested_assignee_slack_id": "U_SAM_WILSON",
                "suggested_assignee_name": "Sam Wilson",
                "source_channel_id": "C_BACKEND_HELP",
                "source_channel_name": "#backend-help",
                "origin_type": "adhoc",
                "trigger_mode": "emoji_reaction",
                "status": "created",
                "jira_ticket_id": "ENG-36",
                "completed_at": now - timedelta(weeks=1, days=2),
            },
            {
                "title": "Add bulk import for inventory items",
                "description": "## Tasks\n- Implement paginated/background bulk import so UI handles 10k+ items without timeout\n- Offload CSV processing to a Celery worker\n- Add progress bar and status updates to the inventory upload UI",
                "priority": "medium",
                "labels": ["adhoc", "feature"],
                "story_points": 1,
                "estimated_hours": 1.5,
                "suggested_assignee_slack_id": "U_ALEX_CHEN",
                "suggested_assignee_name": "Alex Chen",
                "source_channel_id": "C_BACKEND_HELP",
                "source_channel_name": "#backend-help",
                "origin_type": "adhoc",
                "trigger_mode": "automatic",
                "status": "created",
                "jira_ticket_id": "ENG-37",
                "completed_at": now - timedelta(weeks=1, days=1),
            },
        ]

        # ── Sprint 14: 13 planned tickets ─────────────────────────────────────────
        sprint_14_planned_tickets = [
            {"title": "Implement user dashboard redesign", "description": "## Tasks\n- Redesign user dashboard per new Figma specs\n- Implement new navigation layout and color palette\n- Ensure mobile responsiveness for all widgets", "priority": "high", "labels": ["planned", "feature"], "story_points": 5, "estimated_hours": 12.0, "suggested_assignee_slack_id": "U_MAYA_PATEL", "suggested_assignee_name": "Maya Patel", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-44"},
            {"title": "Add PostgreSQL read replicas support", "description": "## Tasks\n- Scale read operations with read replica support\n- Update SQLAlchemy configuration to handle read/write splitting\n- Add health check for database replicas", "priority": "high", "labels": ["planned", "infrastructure"], "story_points": 5, "estimated_hours": 15.0, "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-45"},
            {"title": "Implement OAuth2 PKCE flow for mobile", "description": "## Tasks\n- Add PKCE support for mobile OAuth flow\n- Implement code challenge and verifier generation\n- Update auth-service to validate PKCE tokens", "priority": "high", "labels": ["planned", "security"], "story_points": 3, "estimated_hours": 8.0, "suggested_assignee_slack_id": "U_JORDAN_LEE", "suggested_assignee_name": "Jordan Lee", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-46"},
            {"title": "Build analytics data pipeline v2", "description": "## Tasks\n- Migrate analytics to new event-driven pipeline\n- Implement Kafka producer/consumer for event tracking\n- Validate data consistency between old and new pipelines", "priority": "medium", "labels": ["planned", "data"], "story_points": 5, "estimated_hours": 20.0, "suggested_assignee_slack_id": "U_SAM_WILSON", "suggested_assignee_name": "Sam Wilson", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-47"},
            {"title": "Add unit tests for payment service", "description": "## Tasks\n- Increase test coverage for payment service to 80%\n- Add mock objects for 3rd party payment gateway\n- Test edge cases for payment failures and retries", "priority": "medium", "labels": ["planned", "testing"], "story_points": 3, "estimated_hours": 6.0, "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-48"},
            {"title": "Implement email template system", "description": "## Tasks\n- Build reusable email template system with variables\n- Integrate with SendGrid API for template management\n- Support dynamic content injection for user personalized emails", "priority": "medium", "labels": ["planned", "feature"], "story_points": 3, "estimated_hours": 7.5, "suggested_assignee_slack_id": "U_MAYA_PATEL", "suggested_assignee_name": "Maya Patel", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-49"},
            {"title": "Add Datadog APM integration", "description": "## Tasks\n- Integrate Datadog APM for production monitoring\n- Set up tracing for all microservices\n- Configure custom dashboards for performance metrics", "priority": "medium", "labels": ["planned", "observability"], "story_points": 2, "estimated_hours": 4.0, "suggested_assignee_slack_id": "U_SAM_WILSON", "suggested_assignee_name": "Sam Wilson", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-50"},
            {"title": "Migrate to Python 3.12", "description": "## Tasks\n- Upgrade all services to Python 3.12\n- Update Dockerfile and environment specifications\n- Fix any deprecation warnings from 3rd party libraries", "priority": "low", "labels": ["planned", "maintenance"], "story_points": 2, "estimated_hours": 5.0, "suggested_assignee_slack_id": "U_JORDAN_LEE", "suggested_assignee_name": "Jordan Lee", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-51"},
            {"title": "Document API versioning strategy", "description": "## Tasks\n- Write technical documentation for API versioning\n- Define deprecation policy for old endpoints\n- Publish documentation on the internal developer portal", "priority": "low", "labels": ["planned", "documentation"], "story_points": 1, "estimated_hours": 2.0, "suggested_assignee_slack_id": "U_MAYA_PATEL", "suggested_assignee_name": "Maya Patel", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-52"},
            {"title": "Implement feature flags service", "description": "## Tasks\n- Build internal feature flags for gradual rollouts\n- Connect flags to Unleash or custom management UI\n- Add support for percentage-based rollouts", "priority": "high", "labels": ["planned", "infrastructure"], "story_points": 3, "estimated_hours": 9.0, "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-53"},
            {"title": "Add GraphQL subscriptions support", "description": "## Tasks\n- Implement real-time GraphQL subscriptions\n- Set up Redis as a message broker for pub/sub\n- Update frontend to handle live data updates via WebSockets", "priority": "medium", "labels": ["planned", "feature"], "story_points": 3, "estimated_hours": 11.0, "suggested_assignee_slack_id": "U_SAM_WILSON", "suggested_assignee_name": "Sam Wilson", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-54"},
            {"title": "Implement retry logic for external APIs", "description": "## Tasks\n- Add exponential backoff retry for third-party API calls\n- Implement circuit breaker pattern for external dependencies\n- Log all retry attempts and persistent failures for alerting", "priority": "medium", "labels": ["planned", "reliability"], "story_points": 2, "estimated_hours": 5.5, "suggested_assignee_slack_id": "U_JORDAN_LEE", "suggested_assignee_name": "Jordan Lee", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-55"},
            {"title": "Add health check endpoints to all services", "description": "## Tasks\n- Standardize health check endpoints across services\n- Return 200 OK only if all critical dependencies (DB, Redis) are healthy\n- Integrate with Kubernetes liveness and readiness probes", "priority": "low", "labels": ["planned", "infrastructure"], "story_points": 2, "estimated_hours": 3.5, "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen", "origin_type": "planned", "trigger_mode": "automatic", "status": "created", "jira_ticket_id": "ENG-56"},
        ]

        # Seed Sprint 14 threads → tasks → tickets
        thread_objs = []
        for thread_data in current_threads:
            thread = SlackThread(**thread_data)
            thread.last_analyzed_at = now - timedelta(days=2)
            session.add(thread)
            thread_objs.append(thread)

        await session.flush()

        task_objs = []
        for thread, task_data in zip(thread_objs, current_tasks):
            task = DetectedTask(thread_id=thread.id, **task_data)
            session.add(task)
            task_objs.append(task)

        await session.flush()

        ticket_objs = []
        for task, ticket_data in zip(task_objs, current_tickets):
            ticket = Ticket(
                detected_task_id=task.id,
                sprint_id=sprint_14.id if sprint_14 else None,
                **ticket_data,
            )
            session.add(ticket)
            ticket_objs.append(ticket)

        await session.flush()

        # Seed Sprint 12 + 13 historical tickets (no threads/tasks needed)
        for ticket_data in sprint_12_tickets:
            ticket = Ticket(sprint_id=sprint_12.id if sprint_12 else None, **ticket_data)
            session.add(ticket)

        for ticket_data in sprint_13_tickets:
            ticket = Ticket(sprint_id=sprint_13.id if sprint_13 else None, **ticket_data)
            session.add(ticket)

        # Seed Sprint 14 planned tickets
        for ticket_data in sprint_14_planned_tickets:
            ticket = Ticket(sprint_id=sprint_14.id if sprint_14 else None, **ticket_data)
            session.add(ticket)

        await session.commit()

        total_adhoc = len(current_tickets) + len(sprint_12_tickets) + len(sprint_13_tickets)
        total_planned = len(sprint_14_planned_tickets)
        print(f"  Seeded {len(thread_objs)} threads, {len(task_objs)} tasks")
        print(f"  Seeded {total_adhoc + total_planned} tickets ({total_adhoc} adhoc, {total_planned} planned)")

        # ── Setup manual relationship for demo visibility ─────────────────────────
        # Link ENG-42 (discount_code) as a child of ENG-34 (custom field support)
        eng_34 = await session.execute(select(Ticket).where(Ticket.jira_ticket_id == "ENG-34"))
        eng_42 = await session.execute(select(Ticket).where(Ticket.jira_ticket_id == "ENG-42"))
        
        t34 = eng_34.scalar_one_or_none()
        t42 = eng_42.scalar_one_or_none()
        
        if t34 and t42:
            t42.related_ticket_id = t34.id
            t42.relation_type = "similar_to"
            await session.commit()
            print(f"  Manually linked {t42.jira_ticket_id} to {t34.jira_ticket_id} for demo visibility")

        return ticket_objs, task_objs


async def seed_agent_decisions(ticket_objs, task_objs):
    """
    Seed 8 agent decisions so the activity feed looks alive.

    ticket_objs[0] = orders pagination (auto-assigned to Alex)
    ticket_objs[1] = discount_code    (auto-assigned to Maya)
    ticket_objs[2] = auth tokens      (auto-assigned to Jordan)

    The live demo adds a 9th decision (flagged_for_review for the margin endpoint)
    which then gets approved by the manager in one click.
    """
    now = datetime.now(timezone.utc)

    async with async_session() as session:
        decisions_data = [
            # ── Auto-assigned (3) — the 3 pre-approved Sprint 14 tickets ──────────
            {
                "ticket_id": ticket_objs[0].id,
                "detected_task_id": task_objs[0].id,
                "action": "auto_assigned",
                "confidence": 0.91,
                "reasoning": (
                    "Assigned to Alex Chen based on 12 PRs on orders-service in the last 90 days. "
                    "Confidence 91% exceeded the 80% auto-approve threshold and 3 story points is "
                    "within the 5-point auto-approve limit for #sales-engineering."
                ),
                "assignee_name": "Alex Chen",
                "assignee_reason": "12 PRs on orders-service in last 90 days",
                "jira_ticket_id": "ENG-41",
                "channel_name": "#sales-engineering",
                "story_points": 3,
                "auto_approved": True,
                "created_at": now - timedelta(hours=6),
            },
            {
                "ticket_id": ticket_objs[1].id,
                "detected_task_id": task_objs[1].id,
                "action": "auto_assigned",
                "confidence": 0.88,
                "reasoning": (
                    "Assigned to Maya Patel based on 8 PRs on quotes-service in the last 90 days. "
                    "Confidence 88% exceeded the 85% auto-approve threshold and 2 story points is "
                    "within the 3-point auto-approve limit for #backend-help."
                ),
                "assignee_name": "Maya Patel",
                "assignee_reason": "8 PRs on quotes-service in last 90 days",
                "jira_ticket_id": "ENG-42",
                "channel_name": "#sales-engineering",
                "story_points": 2,
                "auto_approved": True,
                "created_at": now - timedelta(hours=4),
            },
            {
                "ticket_id": ticket_objs[2].id,
                "detected_task_id": task_objs[2].id,
                "action": "auto_assigned",
                "confidence": 0.94,
                "reasoning": (
                    "Assigned to Jordan Lee based on 15 PRs on auth-service in the last 90 days. "
                    "Critical priority. Confidence 94% exceeded the 90% auto-approve threshold."
                ),
                "assignee_name": "Jordan Lee",
                "assignee_reason": "15 PRs on auth-service in last 90 days",
                "jira_ticket_id": "ENG-43",
                "channel_name": "#devops-requests",
                "story_points": 3,
                "auto_approved": True,
                "created_at": now - timedelta(hours=2),
            },
            # ── Flagged for review (2) — tickets too large to auto-approve ────────
            {
                "action": "flagged_for_review",
                "confidence": 0.86,
                "reasoning": (
                    "Flagged for manager review — estimated at 8 story points which exceeds "
                    "the auto-approve limit of 5. Suggested assignee is Sam Wilson based on "
                    "reporting-api ownership."
                ),
                "assignee_name": "Sam Wilson",
                "assignee_reason": "7 PRs on reporting-api in last 90 days",
                "jira_ticket_id": None,
                "channel_name": "#backend-help",
                "story_points": 8,
                "auto_approved": False,
                "created_at": now - timedelta(days=1, hours=2),
            },
            {
                "action": "flagged_for_review",
                "confidence": 0.89,
                "reasoning": (
                    "Flagged for manager review — estimated at 5 story points which exceeds "
                    "the auto-approve limit of 3. Suggested assignee is Alex Chen based on "
                    "recent work on auth-related PRs."
                ),
                "assignee_name": "Alex Chen",
                "assignee_reason": "Recent auth-related PRs",
                "jira_ticket_id": None,
                "channel_name": "#devops-requests",
                "story_points": 5,
                "auto_approved": False,
                "created_at": now - timedelta(days=1, hours=6),
            },
            # ── Dismissed (2) — noise correctly filtered out ───────────────────
            {
                "action": "dismissed",
                "confidence": 0.23,
                "reasoning": (
                    "Thread classified as general conversation with 23% confidence, "
                    "below the 60% detection threshold. No ticket generated."
                ),
                "assignee_name": None,
                "assignee_reason": None,
                "jira_ticket_id": None,
                "channel_name": "#random",
                "story_points": None,
                "auto_approved": False,
                "created_at": now - timedelta(hours=5),
            },
            {
                "action": "dismissed",
                "confidence": 0.61,
                "reasoning": (
                    "Thread classified as a question with 61% confidence, below the 75% "
                    "detection threshold for #sales-engineering. No ticket generated."
                ),
                "assignee_name": None,
                "assignee_reason": None,
                "jira_ticket_id": None,
                "channel_name": "#sales-engineering",
                "story_points": None,
                "auto_approved": False,
                "created_at": now - timedelta(hours=3),
            },
            # ── Pattern matched (1) — reinforces the recurring sales pattern ──────
            {
                "action": "pattern_matched",
                "confidence": 0.95,
                "reasoning": (
                    "Recurring pattern detected: sales team has requested data exposure on the "
                    "quotes endpoint 3 times in 6 weeks. This thread matches prior requests. "
                    "Pattern flagged for manager awareness."
                ),
                "assignee_name": "Maya Patel",
                "assignee_reason": "Primary quotes-service owner",
                "jira_ticket_id": None,
                "channel_name": "#sales-engineering",
                "story_points": None,
                "auto_approved": False,
                "created_at": now - timedelta(days=2, hours=1),
            },
        ]

        decisions = []
        for data in decisions_data:
            decision = AgentDecision(**data)
            session.add(decision)
            decisions.append(decision)

        await session.commit()

        auto_count = sum(1 for d in decisions_data if d["action"] == "auto_assigned")
        flagged_count = sum(1 for d in decisions_data if d["action"] == "flagged_for_review")
        dismissed_count = sum(1 for d in decisions_data if d["action"] == "dismissed")
        pattern_count = sum(1 for d in decisions_data if d["action"] == "pattern_matched")
        print(
            f"  Seeded {len(decisions)} agent decisions "
            f"({auto_count} auto-assigned, {flagged_count} flagged, "
            f"{dismissed_count} dismissed, {pattern_count} pattern-matched)"
        )


async def main():
    print("\n=== Strafe Demo Data Seeder ===\n")
    print("Demo state after seeding:")
    print("  Sprint 14 (active): 3 adhoc approved, 0 drafts pending")
    print("  -> Dashboard shows 'Strafe is fully autonomous right now'")
    print("  -> Post-demo approval brings Sprint 14 to 23.5% adhoc (4/17)")
    print("  Sprint 13 (closed): 22.7% adhoc — #sales-engineering top source")
    print("  Sprint 12 (closed): 14.3% adhoc — the baseline\n")

    print("Initializing database...")
    await init_db()

    print("\n0. Clearing existing demo data...")
    await cleanup_database()

    print("\n1. Seeding channel configs...")
    await seed_channel_configs()

    print("\n2. Seeding expertise map...")
    await seed_expertise_map()

    print("\n3. Seeding sprints...")
    await seed_sprints()

    print("\n4. Seeding historical tasks and tickets...")
    ticket_objs, task_objs = await seed_historical_tasks_and_tickets()

    print("\n5. Seeding agent decisions...")
    await seed_agent_decisions(ticket_objs, task_objs)

    print("\n" + "=" * 40)
    print("Done! Summary:")
    print("  - 4 channel configs (#backend-help, #sales-engineering, #devops-requests, #random)")
    print("  - 9 expertise map entries (Maya's quotes-service score: 9.4, Ryan's: 3.1)")
    print("  - 3 sprints (Sprint 12: 14.3%, Sprint 13: 22.7%, Sprint 14: active)")
    print("  - 26 tickets (11 adhoc, 13 planned + 3 sprint-14 adhoc)")
    print("  - 8 agent decisions (3 auto, 2 flagged, 2 dismissed, 1 pattern)")
    print("\nDraft tickets: 0 — dashboard starts in 'fully autonomous' state")
    print("=" * 40 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
