import asyncio
from app.workers.celery_app import celery_app
from app.services.thread_analyzer import analyze_thread


def run_async(coro):
    """Helper to run async code in sync Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_kwargs={"max_retries": 3},
)
def analyze_thread_task(self, channel_id: str, thread_ts: str, workspace_id: str):
    """
    Celery task to analyze a Slack thread.
    Retries automatically on failure with exponential backoff.
    """
    result = run_async(analyze_thread(channel_id, thread_ts, workspace_id))

    if result:
        classification = result.get("classification", "unknown")
        confidence = result.get("confidence", 0)
        print(
            f"Thread {thread_ts} in {channel_id} classified as '{classification}' "
            f"with {confidence:.0%} confidence"
        )

    return result
