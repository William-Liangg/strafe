import logging
import os
from contextlib import contextmanager

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from app.config import get_settings

logger = logging.getLogger(__name__)

_PROXY_ENV_VARS = [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
]


@contextmanager
def _without_proxy_env():
    removed: dict[str, str] = {}
    for key in _PROXY_ENV_VARS:
        value = os.environ.pop(key, None)
        if value is not None:
            removed[key] = value
    try:
        yield
    finally:
        for key, value in removed.items():
            os.environ[key] = value


class SlackClientService:
    def __init__(self):
        settings = get_settings()
        with _without_proxy_env():
            self.client = WebClient(token=settings.slack_bot_token, proxy=None)

    def get_thread_messages(
        self, channel_id: str, thread_ts: str
    ) -> list[dict] | None:
        """Fetch all messages in a thread."""
        try:
            response = self.client.conversations_replies(
                channel=channel_id, ts=thread_ts
            )
            return response.get("messages", [])
        except SlackApiError as e:
            print(f"Error fetching thread: {e}")
            return None

    def get_channel_info(self, channel_id: str) -> dict | None:
        """Get channel information."""
        try:
            response = self.client.conversations_info(channel=channel_id)
            return response.get("channel")
        except SlackApiError as e:
            print(f"Error fetching channel info: {e}")
            return None

    def get_user_info(self, user_id: str) -> dict | None:
        """Get user information."""
        try:
            response = self.client.users_info(user=user_id)
            return response.get("user")
        except SlackApiError as e:
            print(f"Error fetching user info: {e}")
            return None

    def get_workspace_info(self) -> dict | None:
        """Get workspace/team information."""
        try:
            response = self.client.team_info()
            return response.get("team")
        except SlackApiError as e:
            error_code = e.response.get("error", "unknown") if e.response else "unknown"
            logger.error(f"Slack API error fetching workspace info: {error_code} — {e}")
            raise RuntimeError(f"Slack API error: {error_code}") from e
        except Exception as e:
            logger.error(f"Network error fetching workspace info: {e}")
            raise RuntimeError(f"Network error reaching Slack: {e}") from e

    def list_accessible_channels(self) -> list[dict]:
        """List public and private channels visible to the bot."""
        channels: list[dict] = []
        cursor = None

        try:
            while True:
                response = self.client.conversations_list(
                    types="public_channel,private_channel",
                    exclude_archived=True,
                    limit=200,
                    cursor=cursor,
                )
                channels.extend(
                    c for c in response.get("channels", []) if c.get("is_member")
                )
                cursor = response.get("response_metadata", {}).get("next_cursor")
                if not cursor:
                    break
        except SlackApiError as e:
            logger.error(f"Error listing channels: {e}")
            return []

        return channels

    def get_channel_history(self, channel_id: str, oldest_ts: float) -> list[dict]:
        """Fetch recent channel messages starting from the provided timestamp."""
        messages: list[dict] = []
        cursor = None

        try:
            while True:
                response = self.client.conversations_history(
                    channel=channel_id,
                    oldest=str(oldest_ts),
                    limit=200,
                    cursor=cursor,
                    inclusive=True,
                )
                messages.extend(response.get("messages", []))
                cursor = response.get("response_metadata", {}).get("next_cursor")
                if not cursor:
                    break
        except SlackApiError as e:
            error_code = e.response.get("error", "unknown") if e.response else "unknown"
            logger.error(f"[SLACK] conversations_history failed for channel {channel_id}: {error_code} — {e}")
            return []

        return messages

    def format_thread_for_analysis(self, messages: list[dict]) -> str:
        """Format thread messages into a readable string for Claude."""
        formatted_messages = []
        user_cache = {}

        for msg in messages:
            user_id = msg.get("user", "unknown")
            if user_id not in user_cache:
                user_info = self.get_user_info(user_id)
                user_cache[user_id] = (
                    user_info.get("real_name", user_info.get("name", "Unknown"))
                    if user_info
                    else "Unknown"
                )

            username = user_cache[user_id]
            text = msg.get("text", "")
            ts = msg.get("ts", "")
            formatted_messages.append(f"[{ts}] {username}: {text}")

        return "\n".join(formatted_messages)

    def add_reaction(self, channel_id: str, timestamp: str, reaction: str) -> bool:
        """Add a reaction to a message."""
        try:
            self.client.reactions_add(
                channel=channel_id,
                timestamp=timestamp,
                name=reaction,
            )
            return True
        except SlackApiError as e:
            print(f"Error adding reaction: {e}")
            return False

    def send_dm(self, user_id: str, text: str) -> bool:
        """Send a direct message to a user."""
        try:
            # Open DM channel
            response = self.client.conversations_open(users=[user_id])
            channel_id = response.get("channel", {}).get("id")

            if not channel_id:
                print(f"Could not open DM channel for user {user_id}")
                return False

            # Send message
            self.client.chat_postMessage(channel=channel_id, text=text)
            return True
        except SlackApiError as e:
            print(f"Error sending DM: {e}")
            return False

    def get_permalink(self, channel_id: str, message_ts: str) -> str | None:
        """Get the permalink URL for a message."""
        try:
            response = self.client.chat_getPermalink(
                channel=channel_id,
                message_ts=message_ts,
            )
            return response.get("permalink")
        except SlackApiError as e:
            print(f"Error getting permalink: {e}")
            return None

    def get_message(self, channel_id: str, message_ts: str) -> dict | None:
        """Get a single message by timestamp."""
        try:
            response = self.client.conversations_history(
                channel=channel_id,
                latest=message_ts,
                limit=1,
                inclusive=True,
            )
            messages = response.get("messages", [])
            return messages[0] if messages else None
        except SlackApiError as e:
            print(f"Error fetching message: {e}")
            return None


# Singleton instance
_slack_client: SlackClientService | None = None


def get_slack_client() -> SlackClientService:
    global _slack_client
    if _slack_client is None:
        _slack_client = SlackClientService()
    return _slack_client
