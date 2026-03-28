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
            "channel_id": "C_PLATFORM_ENG",
            "channel_name": "#platform-engineering",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.55,
            "monitoring_active": True,
            "min_replies": 2,
        },
        {
            "channel_id": "C_CUSTOMER_SUCCESS",
            "channel_name": "#customer-success",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.7,
            "monitoring_active": True,
            "min_replies": 3,
        },
        {
            "channel_id": "C_INFRA_ALERTS",
            "channel_name": "#infra-alerts",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.5,
            "monitoring_active": True,
            "min_replies": 1,
        },
        {
            "channel_id": "C_GENERAL",
            "channel_name": "#general",
            "workspace_id": "T_DEMO_WORKSPACE",
            "sensitivity": 0.95,
            "monitoring_active": False,
            "min_replies": 10,
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
            "engineer_slack_id": "U_PRIYA_SHARMA",
            "engineer_name": "Priya Sharma",
            "service_or_domain": "payments-service",
            "score": 9.4,
            "pr_count": 11,
            "last_active": now - timedelta(days=1),
        },
        {
            "engineer_slack_id": "U_PRIYA_SHARMA",
            "engineer_name": "Priya Sharma",
            "service_or_domain": "billing-api",
            "score": 8.1,
            "pr_count": 7,
            "last_active": now - timedelta(days=3),
        },
        {
            "engineer_slack_id": "U_DANIEL_KIM",
            "engineer_name": "Daniel Kim",
            "service_or_domain": "infra-platform",
            "score": 9.0,
            "pr_count": 14,
            "last_active": now - timedelta(days=1),
        },
        {
            "engineer_slack_id": "U_DANIEL_KIM",
            "engineer_name": "Daniel Kim",
            "service_or_domain": "kubernetes-ops",
            "score": 8.5,
            "pr_count": 9,
            "last_active": now - timedelta(days=4),
        },
        {
            "engineer_slack_id": "U_RACHEL_TONG",
            "engineer_name": "Rachel Tong",
            "service_or_domain": "notifications-service",
            "score": 8.7,
            "pr_count": 10,
            "last_active": now - timedelta(days=2),
        },
        {
            "engineer_slack_id": "U_RACHEL_TONG",
            "engineer_name": "Rachel Tong",
            "service_or_domain": "email-api",
            "score": 7.2,
            "pr_count": 5,
            "last_active": now - timedelta(days=6),
        },
        {
            "engineer_slack_id": "U_MARCO_DIAZ",
            "engineer_name": "Marco Diaz",
            "service_or_domain": "search-service",
            "score": 8.3,
            "pr_count": 8,
            "last_active": now - timedelta(days=3),
        },
        {
            "engineer_slack_id": "U_MARCO_DIAZ",
            "engineer_name": "Marco Diaz",
            "service_or_domain": "indexing-api",
            "score": 7.6,
            "pr_count": 6,
            "last_active": now - timedelta(days=7),
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
            "jira_sprint_id": 21,
            "name": "Sprint 21",
            "state": "closed",
            "start_date": now - timedelta(weeks=5),
            "end_date": now - timedelta(weeks=3),
            "adhoc_count": 3,
            "planned_count": 15,
            "adhoc_percentage": 16.7,
            "top_source_channel": "#infra-alerts",
            "total_story_points_adhoc": 8,
            "total_story_points_planned": 42,
        },
        {
            "jira_sprint_id": 22,
            "name": "Sprint 22",
            "state": "closed",
            "start_date": now - timedelta(weeks=3),
            "end_date": now - timedelta(weeks=1),
            "adhoc_count": 5,
            "planned_count": 15,
            "adhoc_percentage": 25.0,
            "top_source_channel": "#customer-success",
            "total_story_points_adhoc": 13,
            "total_story_points_planned": 38,
        },
        {
            "jira_sprint_id": 23,
            "name": "Sprint 23",
            "state": "active",
            "start_date": now - timedelta(weeks=1),
            "end_date": now + timedelta(weeks=1),
            "adhoc_count": 4,
            "planned_count": 13,
            "adhoc_percentage": 23.5,
            "top_source_channel": "#customer-success",
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
        sprint_21 = sprints.get(21)
        sprint_22 = sprints.get(22)
        sprint_23 = sprints.get(23)

        # --- Current Sprint (23) Tickets - 4 adhoc from Slack ---
        # 2 from #customer-success (top source), 1 from #infra-alerts, 1 from #platform-engineering
        current_threads = [
            {"thread_ts": "1712000001.000001", "channel_id": "C_CUSTOMER_SUCCESS", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 5},
            {"thread_ts": "1712000002.000002", "channel_id": "C_CUSTOMER_SUCCESS", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 4},
            {"thread_ts": "1712000003.000003", "channel_id": "C_INFRA_ALERTS", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 6},
            {"thread_ts": "1712000004.000004", "channel_id": "C_PLATFORM_ENG", "workspace_id": "T_DEMO_WORKSPACE", "reply_count": 3},
        ]

        current_tasks = [
            {"classification": "bug", "confidence": 0.94, "title": "Payment retries charging customers twice on timeout", "description": "Idempotency key not passed on retry — results in double charge.", "priority": "critical", "status": "converted"},
            {"classification": "feature_request", "confidence": 0.87, "title": "Expose invoice PDF download endpoint for enterprise accounts", "description": "Enterprise customers need programmatic invoice access.", "priority": "high", "status": "converted"},
            {"classification": "feature_request", "confidence": 0.83, "title": "Add node autoscaling policy for batch jobs", "description": "Batch workloads causing OOM on fixed-size node pools.", "priority": "high", "status": "converted"},
            {"classification": "bug", "confidence": 0.91, "title": "Search index not reflecting deletes within SLA window", "description": "Deleted records still appearing in search results for up to 5 minutes.", "priority": "medium", "status": "converted"},
        ]

        current_tickets = [
            {
                "title": "Payment retries charging customers twice on timeout",
                "description": "## Summary\nIdempotency key not forwarded on retry path causing duplicate charges.\n\n## Acceptance Criteria\n- Pass idempotency key on all retry attempts\n- Add integration test for timeout + retry scenario",
                "priority": "critical", "labels": ["adhoc", "bug"], "story_points": 5,
                "suggested_assignee_slack_id": "U_PRIYA_SHARMA", "suggested_assignee_name": "Priya Sharma",
                "assignee_reason": "11 PRs on payments-service in last 90 days",
                "source_channel_id": "C_CUSTOMER_SUCCESS", "source_channel_name": "#customer-success",
                "source_thread_ts": "1712000001.000001", "origin_type": "adhoc", "trigger_mode": "automatic", "status": "draft",
            },
            {
                "title": "Expose invoice PDF download endpoint for enterprise accounts",
                "description": "## Summary\nEnterprise customers need a REST endpoint to download invoices as PDF.",
                "priority": "high", "labels": ["adhoc", "feature"], "story_points": 3,
                "suggested_assignee_slack_id": "U_PRIYA_SHARMA", "suggested_assignee_name": "Priya Sharma",
                "assignee_reason": "7 PRs on billing-api in last 90 days",
                "source_channel_id": "C_CUSTOMER_SUCCESS", "source_channel_name": "#customer-success",
                "source_thread_ts": "1712000002.000002", "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-61", "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/PLT-61",
            },
            {
                "title": "Add node autoscaling policy for batch jobs",
                "description": "## Summary\nBatch jobs causing OOM kills on current fixed-size node pools.\n\n## Acceptance Criteria\n- Configure HPA/KEDA for batch job queues\n- Set memory limits and requests",
                "priority": "high", "labels": ["adhoc", "infrastructure"], "story_points": 3,
                "suggested_assignee_slack_id": "U_DANIEL_KIM", "suggested_assignee_name": "Daniel Kim",
                "assignee_reason": "14 PRs on infra-platform in last 90 days",
                "source_channel_id": "C_INFRA_ALERTS", "source_channel_name": "#infra-alerts",
                "source_thread_ts": "1712000003.000003", "origin_type": "adhoc", "trigger_mode": "slash_command",
                "status": "created", "jira_ticket_id": "PLT-62", "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/PLT-62",
            },
            {
                "title": "Search index not reflecting deletes within SLA window",
                "description": "## Summary\nDeleted records still appearing in search results for up to 5 minutes post-delete.",
                "priority": "medium", "labels": ["adhoc", "bug"], "story_points": 2,
                "suggested_assignee_slack_id": "U_MARCO_DIAZ", "suggested_assignee_name": "Marco Diaz",
                "assignee_reason": "8 PRs on search-service in last 90 days",
                "source_channel_id": "C_PLATFORM_ENG", "source_channel_name": "#platform-engineering",
                "source_thread_ts": "1712000004.000004", "origin_type": "adhoc", "trigger_mode": "emoji_reaction",
                "status": "created", "jira_ticket_id": "PLT-63", "jira_ticket_url": "https://yourworkspace.atlassian.net/browse/PLT-63",
            },
        ]

        # --- Historical Sprint 21 Tickets (3 adhoc) ---
        sprint_21_tickets = [
            {
                "title": "Fix broken SAML assertion parsing for Okta SSO",
                "description": "## Summary\nOkta SSO logins failing due to incorrect NameID format handling.",
                "priority": "critical", "labels": ["adhoc", "bug"], "story_points": 3,
                "suggested_assignee_slack_id": "U_RACHEL_TONG", "suggested_assignee_name": "Rachel Tong",
                "source_channel_id": "C_CUSTOMER_SUCCESS", "source_channel_name": "#customer-success",
                "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-48", "completed_at": now - timedelta(weeks=3, days=3),
            },
            {
                "title": "Increase Elasticsearch index shard count for logs",
                "description": "## Summary\nLog index hitting shard limits causing write rejections in production.",
                "priority": "high", "labels": ["adhoc", "infrastructure"], "story_points": 2,
                "suggested_assignee_slack_id": "U_DANIEL_KIM", "suggested_assignee_name": "Daniel Kim",
                "source_channel_id": "C_INFRA_ALERTS", "source_channel_name": "#infra-alerts",
                "origin_type": "adhoc", "trigger_mode": "emoji_reaction",
                "status": "created", "jira_ticket_id": "PLT-49", "completed_at": now - timedelta(weeks=3, days=1),
            },
            {
                "title": "Add dead letter queue for failed webhook deliveries",
                "description": "## Summary\nFailed webhooks silently dropped. Need DLQ to inspect and replay.",
                "priority": "medium", "labels": ["adhoc", "feature"], "story_points": 3,
                "suggested_assignee_slack_id": "U_MARCO_DIAZ", "suggested_assignee_name": "Marco Diaz",
                "source_channel_id": "C_PLATFORM_ENG", "source_channel_name": "#platform-engineering",
                "origin_type": "adhoc", "trigger_mode": "slash_command",
                "status": "created", "jira_ticket_id": "PLT-50", "completed_at": now - timedelta(weeks=3, days=2),
            },
        ]

        # --- Historical Sprint 22 Tickets (5 adhoc) ---
        sprint_22_tickets = [
            {
                "title": "Notification emails sending in wrong timezone for EU customers",
                "description": "## Summary\nScheduled notification emails using UTC instead of customer local timezone.",
                "priority": "high", "labels": ["adhoc", "bug"], "story_points": 3,
                "suggested_assignee_slack_id": "U_RACHEL_TONG", "suggested_assignee_name": "Rachel Tong",
                "source_channel_id": "C_CUSTOMER_SUCCESS", "source_channel_name": "#customer-success",
                "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-51", "completed_at": now - timedelta(weeks=1, days=6),
            },
            {
                "title": "Search results missing recently created records",
                "description": "## Summary\nIndex lag causing new records to be invisible in search for up to 10 minutes.",
                "priority": "high", "labels": ["adhoc", "bug"], "story_points": 3,
                "suggested_assignee_slack_id": "U_MARCO_DIAZ", "suggested_assignee_name": "Marco Diaz",
                "source_channel_id": "C_CUSTOMER_SUCCESS", "source_channel_name": "#customer-success",
                "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-52", "completed_at": now - timedelta(weeks=1, days=5),
            },
            {
                "title": "Add Prometheus metrics endpoint to billing service",
                "description": "## Summary\nBilling service missing /metrics endpoint. Oncall can't observe payment latency.",
                "priority": "medium", "labels": ["adhoc", "observability"], "story_points": 2,
                "suggested_assignee_slack_id": "U_PRIYA_SHARMA", "suggested_assignee_name": "Priya Sharma",
                "source_channel_id": "C_INFRA_ALERTS", "source_channel_name": "#infra-alerts",
                "origin_type": "adhoc", "trigger_mode": "slash_command",
                "status": "created", "jira_ticket_id": "PLT-53", "completed_at": now - timedelta(weeks=1, days=4),
            },
            {
                "title": "Pod crashlooping in staging after cert rotation",
                "description": "## Summary\nTLS cert rotation not propagated to mounted secrets. Pods failing liveness probe.",
                "priority": "critical", "labels": ["adhoc", "bug"], "story_points": 3,
                "suggested_assignee_slack_id": "U_DANIEL_KIM", "suggested_assignee_name": "Daniel Kim",
                "source_channel_id": "C_INFRA_ALERTS", "source_channel_name": "#infra-alerts",
                "origin_type": "adhoc", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-54", "completed_at": now - timedelta(weeks=1, days=3),
            },
            {
                "title": "Add support for CC recipients on transactional emails",
                "description": "## Summary\nCustomers requesting CC field support for invoice and alert emails.",
                "priority": "medium", "labels": ["adhoc", "feature"], "story_points": 2,
                "suggested_assignee_slack_id": "U_RACHEL_TONG", "suggested_assignee_name": "Rachel Tong",
                "source_channel_id": "C_CUSTOMER_SUCCESS", "source_channel_name": "#customer-success",
                "origin_type": "adhoc", "trigger_mode": "slash_command",
                "status": "created", "jira_ticket_id": "PLT-55", "completed_at": now - timedelta(weeks=1, days=2),
            },
        ]

        # --- Sprint 23 Planned Tickets (13 planned - from Jira sprint planning) ---
        sprint_23_planned_tickets = [
            {
                "title": "Migrate payments service to gRPC",
                "description": "## Summary\nReplace REST calls between payments and billing with gRPC for lower latency.",
                "priority": "high", "labels": ["planned", "infrastructure"], "story_points": 5,
                "suggested_assignee_slack_id": "U_PRIYA_SHARMA", "suggested_assignee_name": "Priya Sharma",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-64",
            },
            {
                "title": "Set up multi-region failover for Postgres",
                "description": "## Summary\nAdd read replica in EU region with automatic promotion on primary failure.",
                "priority": "high", "labels": ["planned", "reliability"], "story_points": 5,
                "suggested_assignee_slack_id": "U_DANIEL_KIM", "suggested_assignee_name": "Daniel Kim",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-65",
            },
            {
                "title": "Implement idempotency layer for payment API",
                "description": "## Summary\nAdd server-side idempotency key storage to prevent duplicate transactions.",
                "priority": "high", "labels": ["planned", "feature"], "story_points": 3,
                "suggested_assignee_slack_id": "U_PRIYA_SHARMA", "suggested_assignee_name": "Priya Sharma",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-66",
            },
            {
                "title": "Add full-text search to notifications history",
                "description": "## Summary\nUsers want to search past notifications by content and date range.",
                "priority": "medium", "labels": ["planned", "feature"], "story_points": 3,
                "suggested_assignee_slack_id": "U_MARCO_DIAZ", "suggested_assignee_name": "Marco Diaz",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-67",
            },
            {
                "title": "Upgrade Kafka to 3.7 and enable KRaft mode",
                "description": "## Summary\nRemove ZooKeeper dependency by enabling KRaft consensus in Kafka.",
                "priority": "medium", "labels": ["planned", "infrastructure"], "story_points": 3,
                "suggested_assignee_slack_id": "U_DANIEL_KIM", "suggested_assignee_name": "Daniel Kim",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-68",
            },
            {
                "title": "Build notification preference center UI",
                "description": "## Summary\nAllow users to manage per-channel notification preferences in settings.",
                "priority": "medium", "labels": ["planned", "feature"], "story_points": 3,
                "suggested_assignee_slack_id": "U_RACHEL_TONG", "suggested_assignee_name": "Rachel Tong",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-69",
            },
            {
                "title": "Add distributed tracing with OpenTelemetry",
                "description": "## Summary\nInstrument all services with OTEL spans and export to Jaeger.",
                "priority": "medium", "labels": ["planned", "observability"], "story_points": 3,
                "suggested_assignee_slack_id": "U_DANIEL_KIM", "suggested_assignee_name": "Daniel Kim",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-70",
            },
            {
                "title": "Implement search result ranking with BM25",
                "description": "## Summary\nReplace TF-IDF scoring with BM25 for better relevance ranking.",
                "priority": "medium", "labels": ["planned", "feature"], "story_points": 5,
                "suggested_assignee_slack_id": "U_MARCO_DIAZ", "suggested_assignee_name": "Marco Diaz",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-71",
            },
            {
                "title": "Add DKIM signing to outbound emails",
                "description": "## Summary\nImprove email deliverability by signing outbound mail with DKIM.",
                "priority": "low", "labels": ["planned", "security"], "story_points": 2,
                "suggested_assignee_slack_id": "U_RACHEL_TONG", "suggested_assignee_name": "Rachel Tong",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-72",
            },
            {
                "title": "Write runbook for payment incident response",
                "description": "## Summary\nDocument on-call steps for payment processing outages.",
                "priority": "low", "labels": ["planned", "documentation"], "story_points": 1,
                "suggested_assignee_slack_id": "U_PRIYA_SHARMA", "suggested_assignee_name": "Priya Sharma",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-73",
            },
            {
                "title": "Enforce resource quotas per namespace in k8s",
                "description": "## Summary\nPrevent noisy-neighbour issues by adding ResourceQuota per namespace.",
                "priority": "low", "labels": ["planned", "infrastructure"], "story_points": 2,
                "suggested_assignee_slack_id": "U_DANIEL_KIM", "suggested_assignee_name": "Daniel Kim",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-74",
            },
            {
                "title": "Add webhook retry dashboard to admin panel",
                "description": "## Summary\nLet support staff inspect and manually retry failed webhook deliveries.",
                "priority": "low", "labels": ["planned", "feature"], "story_points": 2,
                "suggested_assignee_slack_id": "U_MARCO_DIAZ", "suggested_assignee_name": "Marco Diaz",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-75",
            },
            {
                "title": "Implement circuit breaker for external payment providers",
                "description": "## Summary\nAdd circuit breaker pattern to prevent cascade failures when payment providers are degraded.",
                "priority": "high", "labels": ["planned", "reliability"], "story_points": 3,
                "suggested_assignee_slack_id": "U_PRIYA_SHARMA", "suggested_assignee_name": "Priya Sharma",
                "origin_type": "planned", "trigger_mode": "automatic",
                "status": "created", "jira_ticket_id": "PLT-76",
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
            ticket = Ticket(detected_task_id=task.id, sprint_id=sprint_23.id if sprint_23 else None, **ticket_data)
            session.add(ticket)

        # Seed Sprint 21 tickets (no thread/task needed - historical)
        for ticket_data in sprint_21_tickets:
            ticket = Ticket(sprint_id=sprint_21.id if sprint_21 else None, **ticket_data)
            session.add(ticket)

        # Seed Sprint 22 tickets
        for ticket_data in sprint_22_tickets:
            ticket = Ticket(sprint_id=sprint_22.id if sprint_22 else None, **ticket_data)
            session.add(ticket)

        # Seed Sprint 23 planned tickets (from Jira sprint planning)
        for ticket_data in sprint_23_planned_tickets:
            ticket = Ticket(sprint_id=sprint_23.id if sprint_23 else None, **ticket_data)
            session.add(ticket)

        await session.commit()
        total_tickets = len(current_tickets) + len(sprint_21_tickets) + len(sprint_22_tickets) + len(sprint_23_planned_tickets)
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
