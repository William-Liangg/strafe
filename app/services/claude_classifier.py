import json
from anthropic import Anthropic

from app.config import get_settings

CLASSIFICATION_PROMPT = """You are an expert at analyzing Slack conversations to identify actionable work items.

Analyze the following Slack thread and classify it into ONE of these categories:
- **task**: An actionable work item that someone needs to do (API changes, implementations, configurations, deployments)
- **bug**: A reported problem, error, or issue that needs to be fixed
- **feature_request**: A request for new functionality or enhancement to existing features
- **question**: Someone asking for help, information, or clarification (not requiring code changes)
- **conversation**: General discussion, social chat, or status updates with no actionable items

For tasks, bugs, and feature requests, also extract:
- A concise title (max 80 characters)
- A description with full context from the thread
- Priority level based on urgency cues (high/medium/low)
  - high: words like "urgent", "ASAP", "critical", "blocking", deadlines within 24-48 hours
  - medium: important but not time-critical, deadlines within a week
  - low: nice-to-have, no deadline mentioned

Return your analysis as JSON in this exact format:
{{
  "classification": "task|bug|feature_request|question|conversation",
  "confidence": 0.0-1.0,
  "title": "Concise title if task/bug/feature, null otherwise",
  "description": "Full context description if task/bug/feature, null otherwise",
  "priority": "high|medium|low or null",
  "reasoning": "Brief explanation of why you classified it this way"
}}

Slack Thread:
---
{thread_content}
---

Respond with only the JSON, no additional text."""


class ClaudeClassifier:
    def __init__(self):
        settings = get_settings()
        self.client = Anthropic(api_key=settings.anthropic_api_key)

    def classify_thread(self, thread_content: str) -> dict:
        """Classify a Slack thread using Claude."""
        prompt = CLASSIFICATION_PROMPT.format(thread_content=thread_content)

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = response.content[0].text

        try:
            result = json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract JSON from response if wrapped in markdown
            import re

            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = {
                    "classification": "conversation",
                    "confidence": 0.0,
                    "title": None,
                    "description": None,
                    "priority": None,
                    "reasoning": "Failed to parse Claude response",
                    "raw_response": response_text,
                }

        return result


# Singleton instance
_classifier: ClaudeClassifier | None = None


def get_classifier() -> ClaudeClassifier:
    global _classifier
    if _classifier is None:
        _classifier = ClaudeClassifier()
    return _classifier
