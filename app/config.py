from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://strafe:strafe@localhost:5432/strafe"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Slack
    slack_bot_token: str
    slack_signing_secret: str
    slack_client_id: str = ""
    slack_client_secret: str = ""
    nextauth_url: str = "http://localhost:3000"
    nextauth_secret: str = ""
    next_public_slack_redirect_uri: str = ""

    # Anthropic
    anthropic_api_key: str

    # GitHub
    github_token: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""

    # Jira
    jira_email: str = ""
    jira_api_token: str = ""
    jira_base_url: str = "https://yourworkspace.atlassian.net"
    jira_project_key: str = "ENG"
    jira_board_id: int = 1
    jira_client_id: str = ""

    # Google Calendar
    google_calendar_token: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:3000/api/auth/google/callback"

    # App
    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
