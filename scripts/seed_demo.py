"""
Seed script to populate demo data for Strafe.
Run with: python -m scripts.seed_demo
"""
import asyncio
from app.database import async_session, init_db
from app.models import ChannelConfig, SlackThread, DetectedTask


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


async def seed_historical_tasks():
    """Seed historical detected tasks for demo analytics."""
    # Create threads first
    threads_data = [
        {
            "thread_ts": "1711000001.000001",
            "channel_id": "C_SALES_ENG",
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
            "channel_id": "C_ENG_REQUESTS",
            "workspace_id": "T_DEMO_WORKSPACE",
            "reply_count": 5,
        },
    ]

    tasks_data = [
        {
            "classification": "task",
            "confidence": 0.92,
            "title": "Add CSV export to /users endpoint",
            "description": "Sales team needs ability to export user list as CSV for their quarterly reporting. They need it by end of week.",
            "priority": "high",
            "status": "converted",
        },
        {
            "classification": "bug",
            "confidence": 0.88,
            "title": "Fix timeout on large data exports",
            "description": "Exports over 10k rows are timing out. Need to implement pagination or async processing.",
            "priority": "medium",
            "status": "converted",
        },
        {
            "classification": "feature_request",
            "confidence": 0.85,
            "title": "Add date range filter to analytics API",
            "description": "Product team requesting date range filtering on the analytics endpoints for the new dashboard.",
            "priority": "medium",
            "status": "pending",
        },
    ]

    async with async_session() as session:
        from datetime import datetime, timezone

        threads = []
        for thread_data in threads_data:
            thread = SlackThread(**thread_data)
            thread.last_analyzed_at = datetime.now(timezone.utc)
            session.add(thread)
            threads.append(thread)

        await session.flush()  # Get IDs

        for thread, task_data in zip(threads, tasks_data):
            task = DetectedTask(thread_id=thread.id, **task_data)
            session.add(task)

        await session.commit()
        print(f"Seeded {len(threads)} threads and {len(tasks_data)} detected tasks")


async def main():
    print("Initializing database...")
    await init_db()

    print("Seeding channel configs...")
    await seed_channel_configs()

    print("Seeding historical tasks...")
    await seed_historical_tasks()

    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
