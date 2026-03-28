"""
Script to register Strafe's webhook with Jira.

Usage:
    python -m scripts.register_jira_webhook https://your-ngrok-url.ngrok.io

For local development, use ngrok to expose your local server:
    ngrok http 8000

Then run this script with your ngrok URL.
"""
import asyncio
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.register_jira_webhook <base_url>")
        print("Example: python -m scripts.register_jira_webhook https://abc123.ngrok.io")
        sys.exit(1)

    base_url = sys.argv[1].rstrip("/")
    callback_url = f"{base_url}/webhooks/jira"

    print(f"Registering Jira webhook...")
    print(f"  Callback URL: {callback_url}")
    print()

    from app.services.jira_client import get_jira_client, JiraClientError

    client = get_jira_client()

    # List existing webhooks
    print("Checking existing webhooks...")
    try:
        existing = await client.get_webhooks()
        if existing:
            print(f"  Found {len(existing)} existing webhook(s):")
            for wh in existing:
                print(f"    - {wh.get('name', 'unnamed')}: {wh.get('url', 'no url')} (id: {wh.get('id')})")
        else:
            print("  No existing webhooks found")
    except JiraClientError as e:
        print(f"  Warning: Could not list webhooks: {e.message}")
        existing = []

    print()

    # Check if already registered
    for wh in existing:
        if wh.get("url") == callback_url:
            print(f"Webhook already registered with ID: {wh.get('id')}")
            print("Done!")
            return

    # Register new webhook
    print("Registering new webhook...")
    try:
        result = await client.register_webhook(callback_url)
        if result:
            print(f"  Success! Webhook registered with ID: {result.get('id')}")
            print(f"  Events: jira:issue_created, jira:issue_updated, sprint_started, sprint_closed")
        else:
            print("  Failed to register webhook")
            sys.exit(1)
    except JiraClientError as e:
        print(f"  Error: {e.message}")
        if e.status_code == 401:
            print("  Check your JIRA_EMAIL and JIRA_API_TOKEN environment variables")
        sys.exit(1)

    print()
    print("Done! Your Strafe instance will now receive Jira events.")


if __name__ == "__main__":
    asyncio.run(main())
