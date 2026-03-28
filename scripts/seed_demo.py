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


async def seed_historical_tasks_and_tickets():
    """Seed historical detected tasks and tickets for demo analytics."""
    now = datetime.now(timezone.utc)

    # Create threads first
    threads_data = [
        {
            "thread_ts": "1711000001.000001",
            "channel_id": "C_BACKEND_HELP",
            "workspace_id": "T_DEMO_WORKSPACE",
            "reply_count": 4,
        },
        {
            "thread_ts": "1711000002.000002",
            "channel_id": "C_BACKEND_HELP",
            "workspace_id": "T_DEMO_WORKSPACE",
            "reply_count": 3,
        },
        {
            "thread_ts": "1711000003.000003",
            "channel_id": "C_SALES_ENG",
            "workspace_id": "T_DEMO_WORKSPACE",
            "reply_count": 5,
        },
    ]

    tasks_data = [
        {
            "classification": "feature_request",
            "confidence": 0.92,
            "title": "Expose margin_percent and cost_basis on /v2/quotes endpoint",
            "description": "Sales team needs margin data exposed in the quotes API for their pricing dashboard.",
            "priority": "high",
            "status": "converted",
        },
        {
            "classification": "bug",
            "confidence": 0.88,
            "title": "Fix pagination returning duplicate results on /orders",
            "description": "Pagination on orders endpoint is returning duplicate items when using offset.",
            "priority": "high",
            "status": "converted",
        },
        {
            "classification": "feature_request",
            "confidence": 0.85,
            "title": "Add discount_code field to sales quotes response",
            "description": "Product team requesting discount code field in quotes response for promotions.",
            "priority": "medium",
            "status": "converted",
        },
    ]

    # Tickets corresponding to the tasks (use string values for enums)
    tickets_data = [
        {
            "title": "Expose margin_percent and cost_basis on /v2/quotes endpoint",
            "description": (
                "## Summary\n"
                "Sales team needs margin data exposed in the quotes API for their pricing dashboard.\n\n"
                "## Context\n"
                "Requested by Sarah from Sales Engineering. They need this for the Q2 pricing review.\n\n"
                "## Acceptance Criteria\n"
                "- Add `margin_percent` field to /v2/quotes response\n"
                "- Add `cost_basis` field to /v2/quotes response\n"
                "- Update API documentation\n\n"
                "[Original Slack thread](https://slack.com/archives/C_BACKEND_HELP/p1711000001000001)"
            ),
            "priority": "high",
            "labels": ["adhoc", "feature"],
            "story_points": 5,
            "suggested_assignee_slack_id": "U_MAYA_PATEL",
            "suggested_assignee_name": "Maya Patel",
            "assignee_reason": "8 PRs on quotes-service in last 90 days",
            "source_channel_id": "C_BACKEND_HELP",
            "source_channel_name": "#backend-help",
            "source_thread_ts": "1711000001.000001",
            "source_thread_url": "https://slack.com/archives/C_BACKEND_HELP/p1711000001000001",
            "origin_type": "adhoc",
            "trigger_mode": "automatic",
            "status": "draft",
        },
        {
            "title": "Fix pagination returning duplicate results on /orders",
            "description": (
                "## Summary\n"
                "Pagination on orders endpoint is returning duplicate items when using offset.\n\n"
                "## Bug Details\n"
                "When paginating through orders with offset, some items appear in multiple pages.\n"
                "This is causing issues for the finance team's reconciliation process.\n\n"
                "## Steps to Reproduce\n"
                "1. Call GET /orders?limit=10&offset=0\n"
                "2. Call GET /orders?limit=10&offset=10\n"
                "3. Notice overlapping order IDs\n\n"
                "[Original Slack thread](https://slack.com/archives/C_BACKEND_HELP/p1711000002000002)"
            ),
            "priority": "high",
            "labels": ["adhoc", "bug"],
            "story_points": 3,
            "suggested_assignee_slack_id": "U_ALEX_CHEN",
            "suggested_assignee_name": "Alex Chen",
            "assignee_reason": "12 PRs on orders-service in last 90 days",
            "source_channel_id": "C_BACKEND_HELP",
            "source_channel_name": "#backend-help",
            "source_thread_ts": "1711000002.000002",
            "source_thread_url": "https://slack.com/archives/C_BACKEND_HELP/p1711000002000002",
            "origin_type": "adhoc",
            "trigger_mode": "automatic",
            "status": "created",
            "jira_ticket_id": "ENG-41",
            "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/ENG-41",
        },
        {
            "title": "Add discount_code field to sales quotes response",
            "description": (
                "## Summary\n"
                "Product team requesting discount code field in quotes response for promotions.\n\n"
                "## Context\n"
                "Marketing is launching a Q2 promotion campaign and needs discount codes\n"
                "to be visible in the quotes API for tracking purposes.\n\n"
                "## Acceptance Criteria\n"
                "- Add `discount_code` field to quotes response\n"
                "- Field should be nullable (not all quotes have discounts)\n"
                "- Include in v1 and v2 endpoints\n\n"
                "[Original Slack thread](https://slack.com/archives/C_SALES_ENG/p1711000003000003)"
            ),
            "priority": "medium",
            "labels": ["adhoc", "feature"],
            "story_points": 2,
            "suggested_assignee_slack_id": "U_MAYA_PATEL",
            "suggested_assignee_name": "Maya Patel",
            "assignee_reason": "8 PRs on quotes-service in last 90 days",
            "source_channel_id": "C_SALES_ENG",
            "source_channel_name": "#sales-engineering",
            "source_thread_ts": "1711000003.000003",
            "source_thread_url": "https://slack.com/archives/C_SALES_ENG/p1711000003000003",
            "origin_type": "adhoc",
            "trigger_mode": "automatic",
            "status": "created",
            "jira_ticket_id": "ENG-38",
            "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/ENG-38",
        },
    ]

    async with async_session() as session:
        threads = []
        for thread_data in threads_data:
            thread = SlackThread(**thread_data)
            thread.last_analyzed_at = now - timedelta(days=2)
            session.add(thread)
            threads.append(thread)

        await session.flush()  # Get thread IDs

        tasks = []
        for thread, task_data in zip(threads, tasks_data):
            task = DetectedTask(thread_id=thread.id, **task_data)
            session.add(task)
            tasks.append(task)

        await session.flush()  # Get task IDs

        for task, ticket_data in zip(tasks, tickets_data):
            ticket = Ticket(detected_task_id=task.id, **ticket_data)
            session.add(ticket)

        await session.commit()
        print(f"Seeded {len(threads)} threads, {len(tasks)} tasks, and {len(tickets_data)} tickets")


async def main():
    print("Initializing database...")
    await init_db()

    print("Seeding channel configs...")
    await seed_channel_configs()

    print("Seeding expertise map...")
    await seed_expertise_map()

    print("Seeding historical tasks and tickets...")
    await seed_historical_tasks_and_tickets()

    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
