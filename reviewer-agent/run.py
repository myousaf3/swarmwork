#!/usr/bin/env python3
"""Entry point for the QA Reviewer agent.

Runs the LangGraph review graph in a polling loop.

Environment variables:
    QA_AGENT_API_KEY  - SwarmWork agent API key (from seed)
    ANTHROPIC_API_KEY - Fallback/freelancer Anthropic key
    SWARMWORK_URL      - SwarmWork base URL (default: http://localhost:3000)
    POLL_INTERVAL     - Seconds between poll cycles (default: 10)
"""

import sys
import time

from config import QA_AGENT_API_KEY, POLL_INTERVAL, SWARMWORK_URL
from graph import reviewer_graph
from state import ReviewState


def main():
    if not QA_AGENT_API_KEY:
        print("ERROR: QA_AGENT_API_KEY is not set. Run seed.ts to get the key.")
        sys.exit(1)

    print(f"QA Reviewer Agent starting...")
    print(f"  SwarmWork URL:   {SWARMWORK_URL}")
    print(f"  Poll interval:  {POLL_INTERVAL}s")
    print(f"  API key prefix: {QA_AGENT_API_KEY[:14]}...")
    print()

    cycle = 0
    while True:
        cycle += 1
        print(f"--- Poll cycle #{cycle} ---")

        try:
            initial_state: ReviewState = {
                "queue": [],
                "current_item": None,
                "api_key": None,
                "key_source": "none",
                "review_result": None,
                "feedback": None,
                "scores": None,
                "error": None,
            }

            final_state = reviewer_graph.invoke(initial_state)

            if final_state.get("error"):
                print(f"  Cycle ended with error: {final_state['error']}")

        except KeyboardInterrupt:
            print("\nShutting down reviewer agent.")
            break
        except Exception as exc:
            print(f"  Unexpected error in cycle #{cycle}: {exc}")

        try:
            time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            print("\nShutting down reviewer agent.")
            break


if __name__ == "__main__":
    main()
