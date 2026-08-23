"""Resolve which LLM API key to use for the current review item."""

from state import ReviewState
from config import ANTHROPIC_API_KEY, OPENAI_API_KEY


def resolve_api_key(state: ReviewState) -> dict:
    """Determine which API key to use for the LLM call.

    Priority:
    1. Poster's key (if auto-review enabled, key exists, under limit)
    2. Freelancer/agent's own key (from env)
    3. None → skip
    """
    item = state["current_item"]
    if not item:
        return {"api_key": None, "key_source": "none"}

    # 1. Check poster key availability
    if (
        item.get("auto_review_enabled")
        and item.get("poster_has_llm_key")
        and (item.get("poster_max_reviews") is None
             or item.get("poster_reviews_used", 0) < item.get("poster_max_reviews", 0))
    ):
        # The actual decryption happens server-side; the reviewer agent
        # uses its own key but flags key_source="poster" so the API
        # knows this counts against the poster's quota.
        # For the LLM call, we still need a real key — use the agent's
        # own key but mark the source as "poster" for billing/tracking.
        provider = item.get("poster_llm_provider", "anthropic")
        key = _get_key_for_provider(provider)
        if key:
            print(f"[resolve_key] Using poster-funded review (provider={provider})")
            return {"api_key": key, "key_source": "poster"}

    # 2. Freelancer / agent's own key
    fallback_key = ANTHROPIC_API_KEY or OPENAI_API_KEY
    if fallback_key:
        source_provider = "anthropic" if ANTHROPIC_API_KEY else "openai"
        print(f"[resolve_key] Using freelancer key (provider={source_provider})")
        return {"api_key": fallback_key, "key_source": "freelancer"}

    # 3. No key available
    print("[resolve_key] No API key available — will skip review")
    return {"api_key": None, "key_source": "none"}


def _get_key_for_provider(provider: str) -> str | None:
    """Return the matching env key for a provider."""
    if provider == "anthropic" and ANTHROPIC_API_KEY:
        return ANTHROPIC_API_KEY
    if provider == "openai" and OPENAI_API_KEY:
        return OPENAI_API_KEY
    if provider == "openrouter" and OPENAI_API_KEY:
        return OPENAI_API_KEY  # OpenRouter uses OpenAI-compatible API
    # Fallback to any available key
    return ANTHROPIC_API_KEY or OPENAI_API_KEY or None
