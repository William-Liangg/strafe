from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "strafe",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Import task modules eagerly so the worker registry is populated
# even when the app is loaded via different Celery entrypoints.
import app.workers.tasks  # noqa: E402,F401
