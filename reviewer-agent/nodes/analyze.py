"""LLM analysis node — evaluates deliverable against task requirements."""

from __future__ import annotations

import json
import re

from state import ReviewState
from config import ANTHROPIC_API_KEY

REVIEW_PROMPT = """\
You are a strict QA reviewer for a task marketplace.

## Task
**Title:** {title}
**Description:** {description}
**Requirements:** {requirements}

## Submitted Deliverable (Revision #{revision})
{content}

---

Evaluate the deliverable against the task requirements. Be fair but thorough.

You MUST respond with a JSON object (no markdown fencing) containing exactly:
{{
  "result": "pass" or "fail",
  "feedback": "Detailed explanation of your verdict (2-4 sentences)",
  "scores": {{
    "requirements_met": <1-10>,
    "completeness": <1-10>,
    "quality": <1-10>
  }}
}}

Rules:
- "pass" if the deliverable reasonably satisfies the stated requirements.
- "fail" if key requirements are missing, the output is incomplete, or quality is clearly insufficient.
- Provide actionable feedback the agent can use to improve.
"""


def analyze_content(state: ReviewState) -> dict:
    """Call the LLM to evaluate the deliverable. Returns result, feedback, scores."""
    item = state["current_item"]
    api_key = state.get("api_key")
    key_source = state.get("key_source", "none")

    if not item or not api_key:
        return {
            "review_result": "skipped",
            "feedback": "No API key available for analysis",
            "scores": None,
        }

    prompt = REVIEW_PROMPT.format(
        title=item.get("task_title", ""),
        description=item.get("task_description", ""),
        requirements=item.get("task_requirements", "N/A"),
        revision=item.get("deliverable_revision_number", 1),
        content=item.get("deliverable_content", ""),
    )

    try:
        llm_response = _call_llm(api_key, prompt, key_source, item)
        parsed = _parse_response(llm_response)

        print(
            f"[analyze] Result: {parsed['result']} | "
            f"Scores: {parsed.get('scores', {})} | "
            f"Feedback: {parsed['feedback'][:80]}..."
        )

        return {
            "review_result": parsed["result"],
            "feedback": parsed["feedback"],
            "scores": parsed.get("scores"),
        }
    except Exception as exc:
        print(f"[analyze] Error during LLM call: {exc}")
        return {
            "review_result": "skipped",
            "feedback": f"LLM analysis failed: {exc}",
            "scores": None,
            "error": str(exc),
        }


def _call_llm(
    api_key: str,
    prompt: str,
    key_source: str,
    item: dict,
) -> str:
    """Route to the appropriate LLM provider."""
    provider = item.get("poster_llm_provider", "anthropic") if key_source == "poster" else None

    # Default to Anthropic if we have an Anthropic key
    if not provider:
        provider = "anthropic" if api_key == ANTHROPIC_API_KEY else "openai"

    if provider == "anthropic":
        return _call_anthropic(api_key, prompt)
    else:
        return _call_openai(api_key, prompt, provider)


def _call_anthropic(api_key: str, prompt: str) -> str:
    """Call Anthropic's Messages API."""
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def _call_openai(api_key: str, prompt: str, provider: str = "openai") -> str:
    """Call OpenAI or OpenRouter API."""
    import openai

    base_url = None
    model = "gpt-4o-mini"

    if provider == "openrouter":
        base_url = "https://openrouter.ai/api/v1"
        model = "anthropic/claude-3.5-sonnet"

    client = openai.OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
    )
    return response.choices[0].message.content or ""


def _parse_response(text: str) -> dict:
    """Parse the LLM response into structured result."""
    # Try to extract JSON from the response
    # Remove markdown code fences if present
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`")

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            # Fallback: treat entire response as feedback, default to fail
            return {
                "result": "fail",
                "feedback": text[:500],
                "scores": {"requirements_met": 5, "completeness": 5, "quality": 5},
            }

    result = data.get("result", "fail").lower()
    if result not in ("pass", "fail"):
        result = "fail"

    return {
        "result": result,
        "feedback": data.get("feedback", "No feedback provided"),
        "scores": data.get("scores", {}),
    }
