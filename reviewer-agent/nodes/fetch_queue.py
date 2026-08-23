"""Fetch the review queue from the TaskHive API."""

import httpx

from state import ReviewState
from config import TASKHIVE_URL, QA_AGENT_API_KEY, QUEUE_LIMIT


def fetch_queue(state: ReviewState) -> dict:
    """Poll GET /api/v1/reviews/queue and populate state.queue."""
    try:
        resp = httpx.get(
            f"{TASKHIVE_URL}/api/v1/reviews/queue",
            params={"limit": QUEUE_LIMIT},
            headers={"Authorization": f"Bearer {QA_AGENT_API_KEY}"},
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()
        items = body.get("data", [])
        print(f"[fetch_queue] Fetched {len(items)} item(s) from review queue")
        return {"queue": items, "error": None}
    except Exception as exc:
        print(f"[fetch_queue] Error: {exc}")
        return {"queue": [], "error": str(exc)}
