import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import httpx

from app.config import get_settings

router = APIRouter()


class ServiceStatus(BaseModel):
    connected: bool
    workspace: str | None = None
    user: str | None = None
    org: str | None = None


class IntegrationStatusResponse(BaseModel):
    jira: ServiceStatus
    github: ServiceStatus
    google_calendar: ServiceStatus


class DisconnectResponse(BaseModel):
    success: bool
    message: str


def extract_jira_base_url(url: str) -> str:
    """Extract base Atlassian URL from potentially full board URL"""
    # Handle URLs like https://yhack2026.atlassian.net/jira/software/projects/...
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


async def check_jira_status() -> ServiceStatus:
    """Check Jira connection by calling /rest/api/3/myself"""
    settings = get_settings()

    if not settings.jira_api_token or not settings.jira_base_url or not settings.jira_email:
        return ServiceStatus(connected=False)

    try:
        # Extract just the base URL in case full board URL was provided
        base_url = extract_jira_base_url(settings.jira_base_url)

        async with httpx.AsyncClient(timeout=5.0) as client:
            # Jira uses Basic auth with email:api_token
            import base64
            credentials = base64.b64encode(
                f"{settings.jira_email}:{settings.jira_api_token}".encode()
            ).decode()

            response = await client.get(
                f"{base_url}/rest/api/3/myself",
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Accept": "application/json",
                }
            )

            if response.status_code == 200:
                data = response.json()
                # Extract workspace domain from base URL
                workspace = base_url.replace("https://", "").replace("http://", "")
                return ServiceStatus(
                    connected=True,
                    workspace=workspace,
                    user=data.get("displayName", data.get("emailAddress", "Unknown"))
                )
            else:
                return ServiceStatus(connected=False)
    except Exception:
        return ServiceStatus(connected=False)


async def check_github_status() -> ServiceStatus:
    """Check GitHub connection by calling /user"""
    settings = get_settings()

    if not settings.github_token:
        return ServiceStatus(connected=False)

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {settings.github_token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                }
            )

            if response.status_code == 200:
                data = response.json()
                return ServiceStatus(
                    connected=True,
                    org=data.get("login", "Unknown")
                )
            else:
                return ServiceStatus(connected=False)
    except Exception:
        return ServiceStatus(connected=False)


async def check_google_calendar_status() -> ServiceStatus:
    """Check if Google Calendar token is configured"""
    settings = get_settings()

    # For now, just check if the token env var exists
    if settings.google_calendar_token:
        return ServiceStatus(connected=True)
    else:
        return ServiceStatus(connected=False)


@router.get("/status", response_model=IntegrationStatusResponse)
async def get_integration_status():
    """Get connection status for all integrations in parallel"""
    jira_status, github_status, gcal_status = await asyncio.gather(
        check_jira_status(),
        check_github_status(),
        check_google_calendar_status(),
    )

    return IntegrationStatusResponse(
        jira=jira_status,
        github=github_status,
        google_calendar=gcal_status,
    )


@router.post("/disconnect/{service}", response_model=DisconnectResponse)
async def disconnect_integration(service: str):
    """Disconnect an integration"""
    valid_services = ["jira", "github", "google_calendar"]

    if service not in valid_services:
        raise HTTPException(status_code=400, detail=f"Invalid service: {service}")

    # TODO: In production, implement actual token revocation:
    # - For Jira: Call Atlassian token revocation endpoint
    # - For GitHub: Call GitHub OAuth app token revocation
    # - For Google: Call Google OAuth token revocation
    # Also clear tokens from database/env

    service_name = service.replace("_", " ").title()
    return DisconnectResponse(
        success=True,
        message=f"Disconnected {service_name}"
    )


@router.get("/connect/jira")
async def connect_jira():
    """Initiate Jira OAuth flow"""
    settings = get_settings()

    if not settings.jira_client_id:
        return {
            "error": "OAuth not configured",
            "fallback": "api_token",
            "message": "Configure JIRA_CLIENT_ID or use API token authentication"
        }

    # Atlassian OAuth 2.0 authorization URL
    redirect_uri = f"{settings.nextauth_url}/api/integrations/callback/jira"
    scopes = "read:jira-work read:jira-user write:jira-work"

    auth_url = (
        "https://auth.atlassian.com/authorize"
        f"?audience=api.atlassian.com"
        f"&client_id={settings.jira_client_id}"
        f"&scope={scopes}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&prompt=consent"
    )

    return RedirectResponse(url=auth_url)


@router.get("/connect/github")
async def connect_github():
    """Initiate GitHub OAuth flow"""
    settings = get_settings()

    if not settings.github_client_id:
        return {
            "error": "OAuth not configured",
            "message": "Configure GITHUB_CLIENT_ID for OAuth authentication"
        }

    redirect_uri = f"{settings.nextauth_url}/api/integrations/callback/github"
    scopes = "read:user repo"

    auth_url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scopes}"
    )

    return RedirectResponse(url=auth_url)


@router.get("/connect/google_calendar")
async def connect_google_calendar():
    """Initiate Google Calendar OAuth flow"""
    settings = get_settings()

    if not settings.google_client_id:
        return {
            "error": "OAuth not configured",
            "message": "Configure GOOGLE_CLIENT_ID for OAuth authentication"
        }

    # Google OAuth 2.0 authorization URL
    redirect_uri = settings.google_redirect_uri
    scopes = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email"

    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.google_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={scopes}"
        f"&access_type=offline"
        f"&prompt=consent"
    )

    return RedirectResponse(url=auth_url)
