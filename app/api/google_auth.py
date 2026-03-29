"""
API routes for Google Calendar OAuth flow.

Two endpoints:
  GET /api/auth/google/login?engineer_id=...   → Redirects to Google consent screen
  GET /api/auth/google/callback                → Handles the redirect back from Google
"""

import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse, HTMLResponse

from app.services.google_calendar import build_oauth_url, exchange_code_for_tokens

logger = logging.getLogger(__name__)

router = APIRouter()

# ──────────────────────────────────────────────────────────────
# In-memory token store (MVP only).
# In production, these would be encrypted rows in your PostgreSQL
# engineers table alongside their slack_user_id / jira_account_id.
# ──────────────────────────────────────────────────────────────
_token_store: dict[str, dict] = {}


def get_tokens(engineer_id: str) -> dict | None:
    """Public accessor so other services can look up stored tokens."""
    return _token_store.get(engineer_id)


# ─── Step 1: Redirect to Google ───────────────────────────────
@router.get("/auth/google/login")
async def google_login(engineer_id: str):
    """Kick off the OAuth flow for a given engineer."""
    if not engineer_id:
        raise HTTPException(status_code=400, detail="engineer_id is required")

    try:
        url = build_oauth_url(engineer_id)
        return RedirectResponse(url=url)
    except Exception as e:
        logger.error(f"Failed to build Google OAuth URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Step 2: Handle the callback from Google ──────────────────
@router.get("/auth/google/callback")
async def google_callback(request: Request):
    """
    Google redirects here after the user approves.
    We exchange the auth code for tokens and store them.
    """
    code = request.query_params.get("code")
    engineer_id = request.query_params.get("state")

    if not code or not engineer_id:
        raise HTTPException(status_code=400, detail="Missing code or state from Google")

    try:
        tokens = exchange_code_for_tokens(code, engineer_id)

        # Store tokens (MVP: in-memory; prod: encrypted in DB)
        _token_store[engineer_id] = {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
        }

        logger.info(f"Google Calendar connected for engineer {engineer_id}")

        return HTMLResponse(
            """
            <html>
            <body style="font-family: system-ui; padding: 60px; text-align: center;">
                <h2>✅ Google Calendar Connected</h2>
                <p>Your calendar is now linked to Strafe. You can close this tab.</p>
            </body>
            </html>
            """
        )

    except Exception as e:
        logger.error(f"Google OAuth callback failed: {e}")
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {e}")


# ─── Utility: check weekly availability ───────────────────────
@router.get("/auth/google/availability/{engineer_id}")
async def check_availability(engineer_id: str, tz_offset: int = -4):
    """
    Query an engineer's work week availability (Mon-Fri, 9am-5pm).

    Returns per-day breakdown of:
      - Remaining work hours
      - Meeting hours (clipped to 9-5)
      - Available coding hours

    tz_offset: UTC offset in hours (e.g. -4 for EDT, -5 for EST)
    """
    from app.services.google_calendar import get_weekly_availability

    tokens = _token_store.get(engineer_id)
    if not tokens:
        raise HTTPException(
            status_code=404,
            detail=f"No Google Calendar tokens found for {engineer_id}. Connect first via /api/auth/google/login?engineer_id={engineer_id}",
        )

    result = await get_weekly_availability(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        tz_offset_hours=tz_offset,
    )

    if result.get("error") == "token_expired":
        raise HTTPException(status_code=401, detail="Google token expired — engineer needs to reconnect.")

    return {
        "engineer_id": engineer_id,
        **result,
    }
