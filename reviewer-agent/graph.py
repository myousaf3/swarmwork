"""LangGraph graph definition for the QA Reviewer agent."""

from langgraph.graph import StateGraph, END

from state import ReviewState
from nodes.fetch_queue import fetch_queue
from nodes.resolve_key import resolve_api_key
from nodes.analyze import analyze_content
from nodes.post_review import post_review


def pick_item(state: ReviewState) -> dict:
    """Pop the next item from the queue. If empty, signal end."""
    queue = list(state.get("queue") or [])
    if not queue:
        print("[pick_item] Queue empty — cycle complete")
        return {
            "current_item": None,
            "api_key": None,
            "key_source": "none",
            "review_result": None,
            "feedback": None,
            "scores": None,
            "error": None,
        }
    item = queue.pop(0)
    print(
        f"[pick_item] Processing deliverable {item['deliverable_id']} "
        f"for task {item['task_id']} ({item.get('task_title', '')})"
    )
    return {
        "queue": queue,
        "current_item": item,
        "api_key": None,
        "key_source": "none",
        "review_result": None,
        "feedback": None,
        "scores": None,
        "error": None,
    }


def skip_review(state: ReviewState) -> dict:
    """Log skip and clear current item."""
    item = state.get("current_item")
    if item:
        print(
            f"[skip_review] Skipping deliverable {item['deliverable_id']} "
            f"for task {item['task_id']} — no API key available"
        )
    return {"review_result": "skipped", "feedback": "No API key available"}


# --- Routing functions ---

def has_items(state: ReviewState) -> str:
    """Route: if current_item is set, continue; else END."""
    return "continue" if state.get("current_item") else "end"


def has_key(state: ReviewState) -> str:
    """Route: if api_key resolved, analyze; else skip."""
    return "analyze" if state.get("api_key") else "skip"


# --- Build the graph ---

def build_graph() -> StateGraph:
    """Construct and compile the LangGraph state graph."""
    graph = StateGraph(ReviewState)

    # Add nodes
    graph.add_node("fetch_queue", fetch_queue)
    graph.add_node("pick_item", pick_item)
    graph.add_node("resolve_api_key", resolve_api_key)
    graph.add_node("analyze_content", analyze_content)
    graph.add_node("post_review", post_review)
    graph.add_node("skip_review", skip_review)

    # Set entry point
    graph.set_entry_point("fetch_queue")

    # Edges
    graph.add_edge("fetch_queue", "pick_item")

    # After pick_item: if we have an item → resolve key; else → END
    graph.add_conditional_edges(
        "pick_item",
        has_items,
        {"continue": "resolve_api_key", "end": END},
    )

    # After resolve_api_key: if key found → analyze; else → skip
    graph.add_conditional_edges(
        "resolve_api_key",
        has_key,
        {"analyze": "analyze_content", "skip": "skip_review"},
    )

    # After analyze → post review
    graph.add_edge("analyze_content", "post_review")

    # After post_review → loop back to pick_item
    graph.add_edge("post_review", "pick_item")

    # After skip_review → loop back to pick_item
    graph.add_edge("skip_review", "pick_item")

    return graph.compile()


# Pre-built compiled graph
reviewer_graph = build_graph()
