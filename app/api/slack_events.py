import hashlib
import hmac
import time
from fastapi import APIRouter, Request, HTTPException, Depends

from app.config import get_settings, Settings
from app.services.thread_analyzer import should_analyze_thread
from app.workers.tasks import analyze_thread_task

router = APIRouter()


def verify_slack_signature(
    request_body: bytes,
    timestamp: str,
    signature: str,
    signing_secret: str,
) -> bool:
    """Verify the request came from Slack."""
    if not timestamp or not signature:
        return False

    try:
        if abs(time.time() - int(timestamp)) > 60 * 5:
            return False
    except ValueError:
        return False

    sig_basestring = f"v0:{timestamp}:{request_body.decode('utf-8')}"
    my_signature = (
        "v0="
        + hmac.new(
            signing_secret.encode(), sig_basestring.encode(), hashlib.sha256
        ).hexdigest()
    )
    return hmac.compare_digest(my_signature, signature)


@router.post("/events")
async def slack_events(request: Request, settings: Settings = Depends(get_settings)):
    body = await request.body()
    payload = await request.json()

    # Handle URL verification challenge FIRST (before signature check)
    # This is needed for initial Slack app setup
    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}

    # For all other requests, verify signature
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")

    if not verify_slack_signature(
        body, timestamp, signature, settings.slack_signing_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Handle events
    if payload.get("type") == "event_callback":
        event = payload.get("event", {})
        await handle_message_event(event)

    return {"ok": True}


async def handle_message_event(event: dict):
    """Process incoming message events."""
    event_type = event.get("type")
    subtype = event.get("subtype")

    # Only process regular messages and thread replies
    if event_type != "message" or subtype in ("bot_message", "message_changed", "message_deleted"):
        return

    channel_id = event.get("channel")
    thread_ts = event.get("thread_ts")  # Present if this is a reply
    message_ts = event.get("ts")

    # We only care about thread replies for task detection
    if not thread_ts:
        return

    # Check if this thread should be analyzed
    should_analyze, workspace_id = await should_analyze_thread(channel_id, thread_ts)

    if should_analyze:
        # Enqueue async analysis task
        analyze_thread_task.delay(
            channel_id=channel_id,
            thread_ts=thread_ts,
            workspace_id=workspace_id,
        )
