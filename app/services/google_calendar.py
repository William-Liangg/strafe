"""
Google Calendar integration service for Strafe.

Handles OAuth token management and FreeBusy queries to determine
engineer availability when suggesting ticket assignees.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

# Allow HTTP for local development (Google OAuth enforces HTTPS by default)
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.config import get_settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


def _build_credentials(
    access_token: str,
    refresh_token: Optional[str],
) -> Credentials:
    """Build a Google Credentials object from stored tokens."""
    settings = get_settings()
    return Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )


async def get_weekly_availability(
    access_token: str,
    refresh_token: Optional[str],
    tz_offset_hours: int = -4,  # Default to EDT
) -> dict:
    """
    Query Google Calendar for the current work week (Mon-Fri, 9am-5pm).

    For each remaining workday this week, calculates:
      - Total working hours (8h per day)
      - Meeting hours (events that overlap 9am-5pm)
      - Available coding hours (8h minus meetings)

    Returns a dict with per-day breakdown and weekly totals.
    """
    import zoneinfo

    creds = _build_credentials(access_token, refresh_token)

    # Build a fixed-offset timezone from the offset
    tz = timezone(timedelta(hours=tz_offset_hours))

    try:
        service = build("calendar", "v3", credentials=creds)

        now_local = datetime.now(tz)
        today = now_local.date()

        # Find the most relevant Monday:
        # If it's Saturday (5) or Sunday (6), jump to next Monday
        # If it's Friday past 5pm, also jump to next Monday
        weekday = today.weekday()  # 0=Mon, 4=Fri, 5=Sat, 6=Sun
        if weekday >= 5:
            # Weekend — next Monday
            days_until_monday = 7 - weekday
            monday = today + timedelta(days=days_until_monday)
        elif weekday == 4 and now_local.hour >= 17:
            # Friday after 5pm — next Monday
            monday = today + timedelta(days=3)
        else:
            # Weekday — this week's Monday
            monday = today - timedelta(days=weekday)

        # Friday of that work week
        friday = monday + timedelta(days=4)

        # Query window: start of Monday 9am to end of Friday 5pm
        week_start = datetime(monday.year, monday.month, monday.day, 9, 0, tzinfo=tz)
        week_end = datetime(friday.year, friday.month, friday.day, 17, 0, tzinfo=tz)

        body = {
            "timeMin": week_start.isoformat(),
            "timeMax": week_end.isoformat(),
            "items": [{"id": "primary"}],
        }

        result = service.freebusy().query(body=body).execute()
        busy = result.get("calendars", {}).get("primary", {}).get("busy", [])

        # Parse all busy blocks into datetime pairs
        busy_blocks = []
        for block in busy:
            start = datetime.fromisoformat(block["start"].replace("Z", "+00:00")).astimezone(tz)
            end = datetime.fromisoformat(block["end"].replace("Z", "+00:00")).astimezone(tz)
            busy_blocks.append((start, end))

        # Calculate per-day availability (Mon=0 through Fri=4)
        days = []
        total_work_hours = 0.0
        total_meeting_hours = 0.0
        total_available_hours = 0.0

        for day_offset in range(5):  # Mon through Fri
            day_date = monday + timedelta(days=day_offset)
            day_start = datetime(day_date.year, day_date.month, day_date.day, 9, 0, tzinfo=tz)
            day_end = datetime(day_date.year, day_date.month, day_date.day, 17, 0, tzinfo=tz)

            # Skip days that are fully in the past
            if day_end < now_local:
                days.append({
                    "date": day_date.isoformat(),
                    "day_name": day_date.strftime("%A"),
                    "is_past": True,
                    "work_hours": 8.0,
                    "meeting_hours": 0.0,
                    "available_hours": 0.0,
                    "meetings": [],
                })
                continue

            # For today, start from now (can't work hours that already passed)
            effective_start = max(day_start, now_local) if day_date == today else day_start

            # If we're past 5pm today, no hours left
            if effective_start >= day_end:
                days.append({
                    "date": day_date.isoformat(),
                    "day_name": day_date.strftime("%A"),
                    "is_past": True,
                    "work_hours": 0.0,
                    "meeting_hours": 0.0,
                    "available_hours": 0.0,
                    "meetings": [],
                })
                continue

            remaining_work_hours = round((day_end - effective_start).total_seconds() / 3600, 1)

            # Sum up meeting hours that overlap with this day's 9-5 window
            day_meeting_minutes = 0.0
            day_meetings = []

            for b_start, b_end in busy_blocks:
                # Clip the meeting to this day's working hours
                overlap_start = max(b_start, effective_start)
                overlap_end = min(b_end, day_end)

                if overlap_start < overlap_end:
                    overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60
                    day_meeting_minutes += overlap_minutes
                    day_meetings.append({
                        "start": overlap_start.strftime("%I:%M %p"),
                        "end": overlap_end.strftime("%I:%M %p"),
                        "duration_hours": round(overlap_minutes / 60, 1),
                    })

            meeting_hours = round(day_meeting_minutes / 60, 1)
            available = round(max(0, remaining_work_hours - meeting_hours), 1)

            total_work_hours += remaining_work_hours
            total_meeting_hours += meeting_hours
            total_available_hours += available

            days.append({
                "date": day_date.isoformat(),
                "day_name": day_date.strftime("%A"),
                "is_past": False,
                "work_hours": remaining_work_hours,
                "meeting_hours": meeting_hours,
                "available_hours": available,
                "meetings": day_meetings,
            })

        return {
            "week_of": monday.isoformat(),
            "timezone": f"UTC{tz_offset_hours:+d}",
            "days": days,
            "summary": {
                "total_work_hours": round(total_work_hours, 1),
                "total_meeting_hours": round(total_meeting_hours, 1),
                "total_available_hours": round(total_available_hours, 1),
                "utilization_percent": round(
                    (total_meeting_hours / total_work_hours * 100) if total_work_hours > 0 else 0, 1
                ),
            },
            "error": None,
        }

    except HttpError as e:
        if e.resp.status == 401:
            logger.warning("Google Calendar token expired or revoked")
            return {"days": [], "summary": None, "error": "token_expired"}
        logger.error(f"Google Calendar API error: {e}")
        return {"days": [], "summary": None, "error": str(e)}
    except Exception as e:
        logger.error(f"Unexpected error querying Google Calendar: {e}")
        return {"days": [], "summary": None, "error": str(e)}


# In-memory store for PKCE code verifiers (keyed by engineer_id)
# In production this would be stored in Redis or a short-lived DB row.
_pkce_store: dict[str, str] = {}


def _generate_code_verifier() -> str:
    """Generate a random PKCE code_verifier (43-128 chars, URL-safe)."""
    import secrets
    return secrets.token_urlsafe(64)[:128]


def _generate_code_challenge(verifier: str) -> str:
    """Generate a PKCE code_challenge from a code_verifier (S256 method)."""
    import hashlib
    import base64
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def build_oauth_url(engineer_id: str) -> str:
    """
    Generate the Google OAuth authorization URL with PKCE.
    Stores the code_verifier so it can be used during token exchange.
    """
    from urllib.parse import urlencode

    settings = get_settings()

    # Generate PKCE pair
    code_verifier = _generate_code_verifier()
    code_challenge = _generate_code_challenge(code_verifier)

    # Store the verifier so we can retrieve it in the callback
    _pkce_store[engineer_id] = code_verifier

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": engineer_id,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }

    return f"https://accounts.google.com/o/oauth2/auth?{urlencode(params)}"


def exchange_code_for_tokens(code: str, engineer_id: str) -> dict:
    """
    Exchange the authorization code for tokens via direct HTTP POST.
    Includes the PKCE code_verifier that matches the code_challenge
    sent during the authorization step.
    """
    import httpx

    settings = get_settings()

    # Retrieve the code_verifier we stored during build_oauth_url
    code_verifier = _pkce_store.pop(engineer_id, None)
    if not code_verifier:
        raise Exception(f"No PKCE code_verifier found for engineer {engineer_id}. Try logging in again.")

    response = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        },
    )

    if response.status_code != 200:
        logger.error(f"Google token exchange failed: {response.text}")
        raise Exception(f"Google token exchange failed: {response.text}")

    data = response.json()
    return {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
    }
