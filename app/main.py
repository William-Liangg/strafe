from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.database import init_db
from app.api import slack_events, health, tasks, channels, tickets


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
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
