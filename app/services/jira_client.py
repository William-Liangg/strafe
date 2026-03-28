import logging
from typing import Any
import httpx
from base64 import b64encode

from app.config import get_settings

logger = logging.getLogger(__name__)


class JiraClientError(Exception):
    """Custom exception for Jira API errors."""
    def __init__(self, message: str, status_code: int | None = None, response_body: Any = None):
        self.message = message
        self.status_code = status_code
        self.response_body = response_body
        super().__init__(self.message)


class JiraClient:
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.jira_base_url.rstrip("/")
        self.project_key = settings.jira_project_key
        self.board_id = settings.jira_board_id

        # Create auth header
        credentials = f"{settings.jira_email}:{settings.jira_api_token}"
        auth_bytes = b64encode(credentials.encode()).decode()
        self.headers = {
            "Authorization": f"Basic {auth_bytes}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        json_data: dict | None = None,
        params: dict | None = None,
    ) -> dict:
        """Make an async request to Jira API."""
        url = f"{self.base_url}{endpoint}"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=self.headers,
                    json=json_data,
                    params=params,
                    timeout=30.0,
                )

                if response.status_code == 401:
                    logger.error("Jira auth failed - check JIRA_EMAIL and JIRA_API_TOKEN")
                    raise JiraClientError(
                        "Jira auth failed - check JIRA_EMAIL and JIRA_API_TOKEN",
                        status_code=401,
                    )

                if response.status_code == 400:
                    body = response.json() if response.content else {}
                    logger.error(f"Jira validation error: {body}")
                    raise JiraClientError(
                        f"Jira validation error: {body}",
                        status_code=400,
                        response_body=body,
                    )

                if response.status_code >= 400:
                    body = response.text
                    logger.error(f"Jira API error {response.status_code}: {body}")
                    raise JiraClientError(
                        f"Jira API error: {body}",
                        status_code=response.status_code,
                        response_body=body,
                    )

                if response.content:
                    return response.json()
                return {}

            except httpx.RequestError as e:
                logger.error(f"Jira request failed: {e}")
                raise JiraClientError(f"Jira request failed: {e}")

    async def create_ticket(
        self,
        title: str,
        description: str,
        priority: str,
        labels: list[str],
        story_points: int,
    ) -> dict:
        """Create a new Jira ticket."""
        # Map priority to Jira priority names
        priority_map = {
            "critical": "Highest",
            "high": "High",
            "medium": "Medium",
            "low": "Low",
        }
        jira_priority = priority_map.get(priority, "Medium")

        # Build the issue payload
        payload = {
            "fields": {
                "project": {"key": self.project_key},
                "summary": title,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": description}],
                        }
                    ],
                },
                "issuetype": {"name": "Task"},
                "priority": {"name": jira_priority},
                "labels": labels,
            }
        }

        # Note: Story points field ID varies by Jira instance
        # Common custom field IDs: customfield_10016, customfield_10026
        # For now, we'll try to set it and log if it fails

        result = await self._request("POST", "/rest/api/3/issue", json_data=payload)

        ticket_key = result.get("key")
        ticket_id = result.get("id")

        logger.info(f"Created Jira ticket: {ticket_key}")

        # Try to set story points (this is often a custom field)
        try:
            await self._set_story_points(ticket_key, story_points)
        except JiraClientError as e:
            logger.warning(f"Could not set story points: {e.message}")

        return {
            "key": ticket_key,
            "id": ticket_id,
            "url": f"{self.base_url}/browse/{ticket_key}",
        }

    async def _set_story_points(self, ticket_key: str, points: int) -> None:
        """Try to set story points on a ticket."""
        # Try common story points field IDs
        field_ids = ["customfield_10016", "customfield_10026", "customfield_10024"]

        for field_id in field_ids:
            try:
                await self._request(
                    "PUT",
                    f"/rest/api/3/issue/{ticket_key}",
                    json_data={"fields": {field_id: points}},
                )
                logger.info(f"Set story points using field {field_id}")
                return
            except JiraClientError:
                continue

        logger.warning("Could not find story points custom field")

    async def get_active_sprint(self) -> dict | None:
        """Get the currently active sprint for the board."""
        try:
            result = await self._request(
                "GET",
                f"/rest/agile/1.0/board/{self.board_id}/sprint",
                params={"state": "active"},
            )
            sprints = result.get("values", [])
            if sprints:
                return sprints[0]
            return None
        except JiraClientError as e:
            logger.warning(f"Could not get active sprint: {e.message}")
            return None

    async def add_to_sprint(self, ticket_key: str, sprint_id: int) -> bool:
        """Add a ticket to a sprint."""
        try:
            await self._request(
                "POST",
                f"/rest/agile/1.0/sprint/{sprint_id}/issue",
                json_data={"issues": [ticket_key]},
            )
            logger.info(f"Added {ticket_key} to sprint {sprint_id}")
            return True
        except JiraClientError as e:
            logger.warning(f"Could not add to sprint: {e.message}")
            return False

    async def get_ticket(self, ticket_key: str) -> dict:
        """Get a ticket by key."""
        return await self._request("GET", f"/rest/api/3/issue/{ticket_key}")


# Singleton instance
_jira_client: JiraClient | None = None


def get_jira_client() -> JiraClient:
    global _jira_client
    if _jira_client is None:
        _jira_client = JiraClient()
    return _jira_client
