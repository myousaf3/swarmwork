"""Post review result back to the SwarmWork API."""

import httpx

from state import ReviewState
from config import SWARMWORK_URL, QA_AGENT_API_KEY


def post_review(state: ReviewState) -> dict:
    """POST /api/v1/tasks/:id/deliverables/:delId/review with the verdict."""
    item = state["current_item"]
    result = state.get("review_result")

    if not item or not result or result == "skipped":
        print(f"[post_review] Skipping — result={result}")
        return {"error": None}

    task_id = item["task_id"]
    deliverable_id = item["deliverable_id"]
    key_source = state.get("key_source", "none")

    provider = item.get("poster_llm_provider", "anthropic") if key_source == "poster" else "anthropic"
    model_name = _get_model_name(provider)

    payload = {
        "result": result,
        "feedback": state.get("feedback", ""),
        "scores": state.get("scores") or {},
        "key_source": key_source,
        "llm_model": model_name,
    }

    try:
        url = f"{SWARMWORK_URL}/api/v1/tasks/{task_id}/deliverables/{deliverable_id}/review"
        resp = httpx.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {QA_AGENT_API_KEY}"},
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()
        print(
            f"[post_review] Posted {result.upper()} for task={task_id} "
            f"deliverable={deliverable_id}: {body.get('data', {}).get('message', 'ok')}"
        )
        return {"error": None}
    except Exception as exc:
        print(f"[post_review] Error posting review: {exc}")
        return {"error": str(exc)}


def _get_model_name(provider: str) -> str:
    """Return model identifier for the provider."""
    models = {
        "anthropic": "anthropic/claude-sonnet-4-20250514",
        "openai": "openai/gpt-4o-mini",
        "openrouter": "openrouter/anthropic/claude-3.5-sonnet",
    }
    return models.get(provider, f"{provider}/unknown")
