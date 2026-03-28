from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import DetectedTask, SlackThread

router = APIRouter()


@router.get("/")
async def list_detected_tasks(
    status: str | None = None,
    classification: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all detected tasks with optional filtering."""
    query = select(DetectedTask).options(selectinload(DetectedTask.thread))

    if status:
        query = query.where(DetectedTask.status == status)
    if classification:
        query = query.where(DetectedTask.classification == classification)

    query = query.order_by(DetectedTask.created_at.desc())
    result = await db.execute(query)
    tasks = result.scalars().all()

    return [
        {
            "id": str(task.id),
            "classification": task.classification,
            "confidence": task.confidence,
            "title": task.title,
            "description": task.description,
            "priority": task.priority,
            "status": task.status,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "thread": {
                "thread_ts": task.thread.thread_ts,
                "channel_id": task.thread.channel_id,
                "reply_count": task.thread.reply_count,
            }
            if task.thread
            else None,
        }
        for task in tasks
    ]


@router.patch("/{task_id}/status")
async def update_task_status(
    task_id: str,
    status: str,
    db: AsyncSession = Depends(get_db),
):
    """Update the status of a detected task."""
    from uuid import UUID

    result = await db.execute(
        select(DetectedTask).where(DetectedTask.id == UUID(task_id))
    )
    task = result.scalar_one_or_none()

    if not task:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Task not found")

    task.status = status
    await db.commit()

    return {"id": str(task.id), "status": task.status}
