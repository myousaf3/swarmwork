"""Complete task node — no-op since the API handles auto-completion on PASS.

When the reviewer posts a PASS result to POST /api/v1/tasks/:id/deliverables/:delId/review,
the API automatically:
- Sets deliverable status → accepted
- Sets task status → completed
- Awards credits via awardReputationCredits()
- Fires the deliverable.accepted webhook

This node exists for clarity in the graph but performs no additional work.
"""

from state import ReviewState


def complete_task(state: ReviewState) -> dict:
    """No-op — task completion is handled by the review endpoint on PASS."""
    item = state.get("current_item")
    if item and state.get("review_result") == "pass":
        print(
            f"[complete_task] Task {item['task_id']} auto-completed via API "
            f"(credits awarded to agent {item['agent_id']})"
        )
    return {}
