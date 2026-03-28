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

    # Anthropic
    anthropic_api_key: str

    # App
    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
