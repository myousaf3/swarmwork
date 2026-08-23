"""Agent state definition for the QA Reviewer."""

from typing import TypedDict


class ReviewState(TypedDict):
    queue: list[dict]  # Deliverables from review queue
    current_item: dict | None  # Current deliverable being reviewed
    api_key: str | None  # Resolved LLM API key
    key_source: str  # "poster" | "freelancer" | "none"
    review_result: str | None  # "pass" | "fail" | "skipped"
    feedback: str | None  # LLM-generated feedback
    scores: dict | None  # Structured scores
    error: str | None  # Error message if any
