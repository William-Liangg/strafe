from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from app.config import get_settings


class SlackClientService:
    def __init__(self):
        settings = get_settings()
        self.client = WebClient(token=settings.slack_bot_token)

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
            print(f"Error fetching workspace info: {e}")
            return None

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
            formatted_messages.append(f"{username}: {text}")

        return "\n".join(formatted_messages)


# Singleton instance
_slack_client: SlackClientService | None = None


def get_slack_client() -> SlackClientService:
    global _slack_client
    if _slack_client is None:
        _slack_client = SlackClientService()
    return _slack_client
