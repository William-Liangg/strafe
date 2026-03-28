import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.database import init_db
from app.api import slack_events, health, tasks, channels, tickets, jira_events, analytics

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()

    # Register Jira webhooks (if configured)
    # Note: In production, pass the actual public URL
    # For local dev, this would be your ngrok URL
    from app.config import get_settings
    settings = get_settings()
    if settings.jira_email and settings.jira_api_token:
        try:
            from app.services.jira_client import register_jira_webhooks
            # Skip auto-registration on startup - use the script instead
            # await register_jira_webhooks("https://your-ngrok-url.ngrok.io")
            logger.info("Jira configured - use scripts/register_jira_webhook.py to register webhooks")
        except Exception as e:
            logger.warning(f"Failed to register Jira webhooks: {e}")

    yield
    # Shutdown
    pass


app = FastAPI(
    title="Strafe Sprint Intelligence",
    description="Automatic task detection and sprint analytics",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(health.router, tags=["health"])
app.include_router(slack_events.router, prefix="/slack", tags=["slack"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(channels.router, prefix="/channels", tags=["channels"])
app.include_router(tickets.router, prefix="/tickets", tags=["tickets"])
app.include_router(jira_events.router, prefix="/webhooks", tags=["webhooks"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
