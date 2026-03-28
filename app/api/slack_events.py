import hashlib
import hmac
import time
import logging
from urllib.parse import parse_qs
from fastapi import APIRouter, Request, HTTPException, Depends, Response

from app.config import get_settings, Settings
from app.services.thread_analyzer import should_analyze_thread, is_channel_monitored
from app.workers.tasks import analyze_and_generate_ticket_task, generate_ticket_task

logger = logging.getLogger(__name__)
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
        event_type = event.get("type")

        if event_type == "message":
            await handle_message_event(event)
        elif event_type == "reaction_added":
            await handle_reaction_event(event)

    return {"ok": True}


@router.post("/commands")
async def slack_slash_command(request: Request, settings: Settings = Depends(get_settings)):
    """Handle Slack slash commands like /strafe log."""
    body = await request.body()

    # Verify signature
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")

    if not verify_slack_signature(
        body, timestamp, signature, settings.slack_signing_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Parse form data
    form_data = parse_qs(body.decode("utf-8"))
    command = form_data.get("command", [""])[0]
    text = form_data.get("text", [""])[0]
    channel_id = form_data.get("channel_id", [""])[0]
    channel_name = form_data.get("channel_name", [""])[0]
    user_id = form_data.get("user_id", [""])[0]

    # Handle /strafe command
    if command == "/strafe":
        return await handle_strafe_command(text, channel_id, channel_name, user_id)

    return Response(
        content="Unknown command",
        media_type="text/plain",
        status_code=200,
    )


async def handle_strafe_command(text: str, channel_id: str, channel_name: str, user_id: str):
    """Handle /strafe slash command."""
    from app.services.slack_client import get_slack_client

    parts = text.strip().split()
    subcommand = parts[0] if parts else "help"

    if subcommand == "log":
        # User wants to log the current thread as a ticket
        # The command must be run in a thread for this to work
        # Unfortunately, slash commands don't include thread_ts directly
        # User needs to provide the thread URL or we check last message

        if len(parts) > 1:
            # User provided a thread link or timestamp
            thread_ref = parts[1]
            # Extract thread_ts from link if needed
            if "slack.com" in thread_ref:
                # Parse from URL like: https://workspace.slack.com/archives/C123/p1234567890123456
                import re
                match = re.search(r"/p(\d+)", thread_ref)
                if match:
                    # Convert pXXXX format to ts format (add decimal)
                    ts_raw = match.group(1)
                    thread_ts = f"{ts_raw[:-6]}.{ts_raw[-6:]}"
                else:
                    return Response(
                        content="Could not parse thread URL. Please provide a valid Slack thread link.",
                        media_type="text/plain",
                    )
            else:
                thread_ts = thread_ref
        else:
            return Response(
                content="Usage: /strafe log <thread_url>\n\nPaste a link to the thread you want to convert to a ticket.",
                media_type="text/plain",
            )

        # Check if channel is monitored
        is_monitored, _ = await is_channel_monitored(channel_id)

        # Enqueue ticket generation - respond immediately
        generate_ticket_task.delay(
            channel_id=channel_id,
            thread_ts=thread_ts,
            channel_name=channel_name or "unknown",
            trigger_mode="slash_command",
        )

        logger.info(f"Slash command: generating ticket for thread {thread_ts} in {channel_id}")

        return Response(
            content="Generating ticket draft for this thread...",
            media_type="text/plain",
        )

    elif subcommand == "help":
        return Response(
            content=(
                "*Strafe Commands*\n"
                "• `/strafe log <thread_url>` - Generate a ticket from a thread\n"
                "• `/strafe help` - Show this help message\n\n"
                "You can also react with :zap: on any message to generate a ticket."
            ),
            media_type="text/plain",
        )

    return Response(
        content=f"Unknown subcommand: {subcommand}. Use `/strafe help` for usage.",
        media_type="text/plain",
    )


async def handle_message_event(event: dict):
    """Process incoming message events."""
    subtype = event.get("subtype")

    # Only process regular messages and thread replies
    if subtype in ("bot_message", "message_changed", "message_deleted"):
        return

    channel_id = event.get("channel")
    thread_ts = event.get("thread_ts")  # Present if this is a reply

    # We only care about thread replies for task detection
    if not thread_ts:
        return

    # Check if this thread should be analyzed
    should_analyze, workspace_id, channel_name = await should_analyze_thread(channel_id, thread_ts)

    if should_analyze:
        # Enqueue combined analysis + ticket generation task
        analyze_and_generate_ticket_task.delay(
            channel_id=channel_id,
            thread_ts=thread_ts,
            workspace_id=workspace_id,
            channel_name=channel_name or "unknown",
        )
        logger.info(f"Enqueued analysis for thread {thread_ts} in {channel_id}")


async def handle_reaction_event(event: dict):
    """Handle reaction_added events - trigger on zap emoji."""
    reaction = event.get("reaction")

    # Only process zap emoji
    if reaction != "zap":
        return

    channel_id = event.get("item", {}).get("channel")
    message_ts = event.get("item", {}).get("ts")
    user_id = event.get("user")

    if not channel_id or not message_ts:
        return

    # Check if channel is monitored
    is_monitored, channel_name = await is_channel_monitored(channel_id)
    if not is_monitored:
        logger.info(f"Zap reaction in unmonitored channel {channel_id}, skipping")
        return

    # Get the message to find thread_ts (could be parent or reply)
    from app.services.slack_client import get_slack_client
    slack_client = get_slack_client()

    # Try to get the message
    message = slack_client.get_message(channel_id, message_ts)
    if not message:
        logger.warning(f"Could not fetch message {message_ts} in {channel_id}")
        return

    # Determine thread_ts - if message is in a thread, use thread_ts; otherwise use message ts as thread start
    thread_ts = message.get("thread_ts", message_ts)

    # Add checkmark reaction to confirm receipt
    slack_client.add_reaction(channel_id, message_ts, "white_check_mark")

    # Enqueue ticket generation
    generate_ticket_task.delay(
        channel_id=channel_id,
        thread_ts=thread_ts,
        channel_name=channel_name or "unknown",
        trigger_mode="emoji_reaction",
    )

    logger.info(f"Zap reaction: generating ticket for thread {thread_ts} in {channel_id}")
