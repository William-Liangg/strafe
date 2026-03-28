"""
Seed script to populate demo data for Strafe.
Run with: python -m scripts.seed_demo
"""
import asyncio
from datetime import datetime, timezone, timedelta
from app.database import async_session, init_db
from app.models import (
    ChannelConfig,
    SlackThread,
    DetectedTask,
    Ticket,
    ExpertiseMap,
    Sprint,
)


async def seed_channel_configs():
    """Seed channel configurations for demo."""
    configs = [
        {
            "channel_id": "C_BACKEND_HELP",
            "channel_name": "#backend-help",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.6,  # High sensitivity
            "monitoring_active": True,
            "min_replies": 2,
        },
        {
            "channel_id": "C_SALES_ENG",
            "channel_name": "#sales-engineering",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.75,  # Medium sensitivity
            "monitoring_active": True,
            "min_replies": 2,
        },
        {
            "channel_id": "C_ENG_REQUESTS",
            "channel_name": "#eng-requests",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.6,
            "monitoring_active": True,
            "min_replies": 2,
        },
        {
            "channel_id": "C_RANDOM",
            "channel_name": "#random",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.9,
            "monitoring_active": False,  # Disabled
            "min_replies": 5,
        },
    ]

    async with async_session() as session:
        for config_data in configs:
            config = ChannelConfig(**config_data)
            session.add(config)
        await session.commit()
        print(f"Seeded {len(configs)} channel configs")


async def seed_expertise_map():
    """Seed expertise map with realistic engineer data."""
    now = datetime.now(timezone.utc)

    experts = [
        {
            "engineer_slack_id": "U_MAYA_PATEL",
            "engineer_name": "Maya Patel",
            "service_or_domain": "quotes-service",
            "score": 9.2,
            "pr_count": 8,
            "last_active": now - timedelta(days=2),
        },
        {
            "engineer_slack_id": "U_MAYA_PATEL",
            "engineer_name": "Maya Patel",
            "service_or_domain": "pricing-api",
            "score": 7.5,
            "pr_count": 5,
            "last_active": now - timedelta(days=5),
        },
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
        print(f"Seeded {len(experts)} expertise map entries")


async def seed_sprints():
    """Seed sprint history for analytics demo."""
    now = datetime.now(timezone.utc)

    sprints_data = [
        {
            "jira_sprint_id": 12,
            "name": "Sprint 12",
            "state": "closed",
            "start_date": now - timedelta(weeks=5),
            "end_date": now - timedelta(weeks=3),
            # Stored metrics for closed sprint
            "adhoc_count": 3,
            "planned_count": 15,
            "adhoc_percentage": 16.7,
            "top_source_channel": "#backend-help",
            "total_story_points_adhoc": 8,
            "total_story_points_planned": 42,
        },
        {
            "jira_sprint_id": 13,
            "name": "Sprint 13",
            "state": "closed",
            "start_date": now - timedelta(weeks=3),
            "end_date": now - timedelta(weeks=1),
            # Stored metrics for closed sprint
            "adhoc_count": 5,
            "planned_count": 15,
            "adhoc_percentage": 25.0,
            "top_source_channel": "#sales-engineering",
            "total_story_points_adhoc": 13,
            "total_story_points_planned": 38,
        },
        {
            "jira_sprint_id": 14,
            "name": "Sprint 14",
            "state": "active",
            "start_date": now - timedelta(weeks=1),
            "end_date": now + timedelta(weeks=1),
            # Store metrics for active sprint too (4 adhoc + 13 planned = 17 total, 23.5% adhoc)
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
        print(f"Seeded {len(sprints)} sprints")
        return sprints


async def seed_historical_tasks_and_tickets():
    """Seed historical detected tasks and tickets for demo analytics."""
    now = datetime.now(timezone.utc)
    from sqlalchemy import select

    async with async_session() as session:
        # Get sprints for assignment
        sprint_result = await session.execute(select(Sprint))
        sprints = {s.jira_sprint_id: s for s in sprint_result.scalars().all()}
        sprint_12 = sprints.get(12)
        sprint_13 = sprints.get(13)
        sprint_14 = sprints.get(14)

        # --- Current Sprint (14) Tickets - 4 adhoc from Slack ---
        # 2 from #sales-engineering (top source), 1 from #backend-help, 1 from #eng-requests
        current_threads = [
            {"thread_ts": "1711000001.000001", "channel_id": "C_SALES_ENG", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 4},
            {"thread_ts": "1711000002.000002", "channel_id": "C_SALES_ENG", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 3},
            {"thread_ts": "1711000003.000003", "channel_id": "C_BACKEND_HELP", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 5},
            {"thread_ts": "1711000004.000004", "channel_id": "C_ENG_REQUESTS", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 6},
        ]

        current_tasks = [
            {"classification": "feature_request", "confidence": 0.92, "title": "Expose margin_percent and cost_basis on /v2/quotes endpoint", "description": "Sales team needs margin data exposed in the quotes API.", "priority": "high", "status": "converted"},
            {"classification": "bug", "confidence": 0.88, "title": "Fix pagination returning duplicate results on /orders", "description": "Pagination on orders endpoint returning duplicate items.", "priority": "high", "status": "converted"},
            {"classification": "feature_request", "confidence": 0.85, "title": "Add discount_code field to sales quotes response", "description": "Product team requesting discount code field.", "priority": "medium", "status": "converted"},
            {"classification": "bug", "confidence": 0.91, "title": "Auth tokens expiring early on mobile clients", "description": "Mobile users reporting frequent logouts.", "priority": "critical", "status": "converted"},
        ]

        current_tickets = [
            {
                "title": "Expose margin_percent and cost_basis on /v2/quotes endpoint",
                "description": "## Summary\nSales team needs margin data exposed in the quotes API.\n\n## Acceptance Criteria\n- Add `margin_percent` field\n- Add `cost_basis` field",
                "priority": "high", "labels": ["adhoc", "feature"], "story_points": 5,
                "suggested_assignee_slack_id": "U_MAYA_PATEL", "suggested_assignee_name": "Maya Patel",
                "assignee_reason": "8 PRs on quotes-service in last 90 days",
                "source_channel_id": "C_SALES_ENG", "source_channel_name": "#sales-engineering",
                "source_thread_ts": "1711000001.000001", "origin_type": "adhoc", "trigger_mode": "automatic", "status": "draft",
            },
            {
                "title": "Fix pagination returning duplicate results on /orders",
                "description": "## Summary\nPagination on orders endpoint is returning duplicate items.\n\n## Steps to Reproduce\n1. Call GET /orders?limit=10&offset=0\n2. Call GET /orders?limit=10&offset=10",
                "priority": "high", "labels": ["adhoc", "bug"], "story_points": 3,
                "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen",
                "assignee_reason": "12 PRs on orders-service in last 90 days",
                "source_channel_id": "C_SALES_ENG", "source_channel_name": "#sales-engineering",
                "source_thread_ts": "1711000002.000002", "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-41", "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/ENG-41",
            },
            {
                "title": "Add discount_code field to sales quotes response",
                "description": "## Summary\nProduct team requesting discount code field in quotes response.",
                "priority": "medium", "labels": ["adhoc", "feature"], "story_points": 2,
                "suggested_assignee_slack_id": "U_MAYA_PATEL", "suggested_assignee_name": "Maya Patel",
                "assignee_reason": "8 PRs on quotes-service in last 90 days",
                "source_channel_id": "C_BACKEND_HELP", "source_channel_name": "#backend-help",
                "source_thread_ts": "1711000003.000003", "origin_type": "adhoc", "trigger_mode": "slash_command",
                "status": "created", "jira_ticket_id": "ENG-42", "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/ENG-42",
            },
            {
                "title": "Auth tokens expiring early on mobile clients",
                "description": "## Summary\nMobile users reporting frequent logouts. Token TTL may be misconfigured.",
                "priority": "critical", "labels": ["adhoc", "bug"], "story_points": 3,
                "suggested_assignee_slack_id": "U_JORDAN_LEE", "suggested_assignee_name": "Jordan Lee",
                "assignee_reason": "15 PRs on auth-service in last 90 days",
                "source_channel_id": "C_ENG_REQUESTS", "source_channel_name": "#eng-requests",
                "source_thread_ts": "1711000004.000004", "origin_type": "adhoc", "trigger_mode": "emoji_reaction",
                "status": "created", "jira_ticket_id": "ENG-43", "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/ENG-43",
            },
        ]

        # --- Historical Sprint 12 Tickets (3 adhoc) ---
        sprint_12_tickets = [
            {
                "title": "Add rate limiting to public API endpoints",
                "description": "## Summary\nCustomer reported API abuse. Need rate limiting on public endpoints.",
                "priority": "high", "labels": ["adhoc", "security"], "story_points": 3,
                "suggested_assignee_slack_id": "U_JORDAN_LEE", "suggested_assignee_name": "Jordan Lee",
                "source_channel_id": "C_BACKEND_HELP", "source_channel_name": "#backend-help",
                "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-28", "completed_at": now - timedelta(weeks=3, days=2),
            },
            {
                "title": "Fix memory leak in websocket connections",
                "description": "## Summary\nProd servers running out of memory after 48hrs. WebSocket connections not cleaning up.",
                "priority": "critical", "labels": ["adhoc", "bug"], "story_points": 3,
                "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen",
                "source_channel_id": "C_BACKEND_HELP", "source_channel_name": "#backend-help",
                "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-29", "completed_at": now - timedelta(weeks=3, days=4),
            },
            {
                "title": "Add CSV export to analytics dashboard",
                "description": "## Summary\nFinance team needs to export analytics data to CSV for reporting.",
                "priority": "medium", "labels": ["adhoc", "feature"], "story_points": 2,
                "suggested_assignee_slack_id": "U_SAM_WILSON", "suggested_assignee_name": "Sam Wilson",
                "source_channel_id": "C_BACKEND_HELP", "source_channel_name": "#backend-help",
                "origin_type": "adhoc", "trigger_mode": "slash_command",
                "status": "created", "jira_ticket_id": "ENG-30", "completed_at": now - timedelta(weeks=3, days=1),
            },
        ]

        # --- Historical Sprint 13 Tickets (5 adhoc) ---
        sprint_13_tickets = [
            {
                "title": "Urgent: Fix SSO login broken for enterprise customers",
                "description": "## Summary\nEnterprise SSO login returning 500 errors. High priority customer escalation.",
                "priority": "critical", "labels": ["adhoc", "bug"], "story_points": 5,
                "suggested_assignee_slack_id": "U_JORDAN_LEE", "suggested_assignee_name": "Jordan Lee",
                "source_channel_id": "C_SALES_ENG", "source_channel_name": "#sales-engineering",
                "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-33", "completed_at": now - timedelta(weeks=1, days=5),
            },
            {
                "title": "Add custom field support to quote builder",
                "description": "## Summary\nSales needs custom fields in quote builder for enterprise deals.",
                "priority": "high", "labels": ["adhoc", "feature"], "story_points": 3,
                "suggested_assignee_slack_id": "U_MAYA_PATEL", "suggested_assignee_name": "Maya Patel",
                "source_channel_id": "C_SALES_ENG", "source_channel_name": "#sales-engineering",
                "origin_type": "adhoc", "trigger_mode": "slash_command",
                "status": "created", "jira_ticket_id": "ENG-34", "completed_at": now - timedelta(weeks=1, days=3),
            },
            {
                "title": "Performance regression in search API after deploy",
                "description": "## Summary\nSearch latency increased 3x after last deploy. P95 now at 800ms.",
                "priority": "high", "labels": ["adhoc", "bug"], "story_points": 2,
                "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen",
                "source_channel_id": "C_SALES_ENG", "source_channel_name": "#sales-engineering",
                "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-35", "completed_at": now - timedelta(weeks=1, days=4),
            },
            {
                "title": "Webhook delivery failures to customer endpoints",
                "description": "## Summary\nWebhook retries exhausting. Customer integration failing silently.",
                "priority": "medium", "labels": ["adhoc", "bug"], "story_points": 2,
                "suggested_assignee_slack_id": "U_SAM_WILSON", "suggested_assignee_name": "Sam Wilson",
                "source_channel_id": "C_BACKEND_HELP", "source_channel_name": "#backend-help",
                "origin_type": "adhoc", "trigger_mode": "emoji_reaction",
                "status": "created", "jira_ticket_id": "ENG-36", "completed_at": now - timedelta(weeks=1, days=2),
            },
            {
                "title": "Add bulk import for inventory items",
                "description": "## Summary\nOperations team needs to import 10k+ items. Current UI times out.",
                "priority": "medium", "labels": ["adhoc", "feature"], "story_points": 1,
                "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen",
                "source_channel_id": "C_ENG_REQUESTS", "source_channel_name": "#eng-requests",
                "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-37", "completed_at": now - timedelta(weeks=1, days=1),
            },
        ]

        # --- Sprint 14 Planned Tickets (13 planned - from Jira sprint planning) ---
        sprint_14_planned_tickets = [
            {
                "title": "Implement user dashboard redesign",
                "description": "## Summary\nRedesign user dashboard per new Figma specs.",
                "priority": "high", "labels": ["planned", "feature"], "story_points": 5,
                "suggested_assignee_slack_id": "U_MAYA_PATEL", "suggested_assignee_name": "Maya Patel",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-44",
            },
            {
                "title": "Add PostgreSQL read replicas support",
                "description": "## Summary\nScale read operations with read replica support.",
                "priority": "high", "labels": ["planned", "infrastructure"], "story_points": 5,
                "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-45",
            },
            {
                "title": "Implement OAuth2 PKCE flow for mobile",
                "description": "## Summary\nAdd PKCE support for mobile OAuth flow.",
                "priority": "high", "labels": ["planned", "security"], "story_points": 3,
                "suggested_assignee_slack_id": "U_JORDAN_LEE", "suggested_assignee_name": "Jordan Lee",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-46",
            },
            {
                "title": "Build analytics data pipeline v2",
                "description": "## Summary\nMigrate analytics to new event-driven pipeline.",
                "priority": "medium", "labels": ["planned", "data"], "story_points": 5,
                "suggested_assignee_slack_id": "U_SAM_WILSON", "suggested_assignee_name": "Sam Wilson",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-47",
            },
            {
                "title": "Add unit tests for payment service",
                "description": "## Summary\nIncrease test coverage for payment service to 80%.",
                "priority": "medium", "labels": ["planned", "testing"], "story_points": 3,
                "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-48",
            },
            {
                "title": "Implement email template system",
                "description": "## Summary\nBuild reusable email template system with variables.",
                "priority": "medium", "labels": ["planned", "feature"], "story_points": 3,
                "suggested_assignee_slack_id": "U_MAYA_PATEL", "suggested_assignee_name": "Maya Patel",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-49",
            },
            {
                "title": "Add Datadog APM integration",
                "description": "## Summary\nIntegrate Datadog APM for production monitoring.",
                "priority": "medium", "labels": ["planned", "observability"], "story_points": 2,
                "suggested_assignee_slack_id": "U_SAM_WILSON", "suggested_assignee_name": "Sam Wilson",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-50",
            },
            {
                "title": "Migrate to Python 3.12",
                "description": "## Summary\nUpgrade all services to Python 3.12.",
                "priority": "low", "labels": ["planned", "maintenance"], "story_points": 2,
                "suggested_assignee_slack_id": "U_JORDAN_LEE", "suggested_assignee_name": "Jordan Lee",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-51",
            },
            {
                "title": "Document API versioning strategy",
                "description": "## Summary\nWrite technical documentation for API versioning.",
                "priority": "low", "labels": ["planned", "documentation"], "story_points": 1,
                "suggested_assignee_slack_id": "U_MAYA_PATEL", "suggested_assignee_name": "Maya Patel",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-52",
            },
            {
                "title": "Implement feature flags service",
                "description": "## Summary\nBuild internal feature flags for gradual rollouts.",
                "priority": "high", "labels": ["planned", "infrastructure"], "story_points": 3,
                "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-53",
            },
            {
                "title": "Add GraphQL subscriptions support",
                "description": "## Summary\nImplement real-time GraphQL subscriptions.",
                "priority": "medium", "labels": ["planned", "feature"], "story_points": 3,
                "suggested_assignee_slack_id": "U_SAM_WILSON", "suggested_assignee_name": "Sam Wilson",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-54",
            },
            {
                "title": "Implement retry logic for external APIs",
                "description": "## Summary\nAdd exponential backoff retry for third-party API calls.",
                "priority": "medium", "labels": ["planned", "reliability"], "story_points": 2,
                "suggested_assignee_slack_id": "U_JORDAN_LEE", "suggested_assignee_name": "Jordan Lee",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-55",
            },
            {
                "title": "Add health check endpoints to all services",
                "description": "## Summary\nStandardize health check endpoints across services.",
                "priority": "low", "labels": ["planned", "infrastructure"], "story_points": 2,
                "suggested_assignee_slack_id": "U_ALEX_CHEN", "suggested_assignee_name": "Alex Chen",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "ENG-56",
            },
        ]

        # Seed current sprint threads, tasks, tickets
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

        for task, ticket_data in zip(task_objs, current_tickets):
            ticket = Ticket(detected_task_id=task.id, sprint_id=sprint_14.id if sprint_14 else None, **ticket_data)
            session.add(ticket)

        # Seed Sprint 12 tickets (no thread/task needed - historical)
        for ticket_data in sprint_12_tickets:
            ticket = Ticket(sprint_id=sprint_12.id if sprint_12 else None, **ticket_data)
            session.add(ticket)

        # Seed Sprint 13 tickets
        for ticket_data in sprint_13_tickets:
            ticket = Ticket(sprint_id=sprint_13.id if sprint_13 else None, **ticket_data)
            session.add(ticket)

        # Seed Sprint 14 planned tickets (from Jira sprint planning)
        for ticket_data in sprint_14_planned_tickets:
            ticket = Ticket(sprint_id=sprint_14.id if sprint_14 else None, **ticket_data)
            session.add(ticket)

        await session.commit()
        total_tickets = len(current_tickets) + len(sprint_12_tickets) + len(sprint_13_tickets) + len(sprint_14_planned_tickets)
        print(f"Seeded {len(thread_objs)} threads, {len(task_objs)} tasks, and {total_tickets} tickets across 3 sprints")


async def main():
    print("Initializing database...")
    await init_db()

    print("Seeding channel configs...")
    await seed_channel_configs()

    print("Seeding expertise map...")
    await seed_expertise_map()

    print("Seeding sprints...")
    await seed_sprints()

    print("Seeding historical tasks and tickets...")
    await seed_historical_tasks_and_tickets()

    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
