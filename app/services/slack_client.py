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
