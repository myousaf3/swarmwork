"""Environment configuration for the QA Reviewer agent."""

import os

from dotenv import load_dotenv

load_dotenv()

# SwarmWork API
SWARMWORK_URL = os.getenv("SWARMWORK_URL", "http://localhost:3000")
QA_AGENT_API_KEY = os.getenv("QA_AGENT_API_KEY", "")

# Fallback / freelancer LLM key (used when poster has no key)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Polling
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))
QUEUE_LIMIT = int(os.getenv("QUEUE_LIMIT", "20"))
