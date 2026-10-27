# Data Model

This document defines the entities, relationships, and constraints for TaskHive. Your database schema must support all entities described here. Field names and types are logical — map them to your ORM/database as appropriate.

---

## Entities

### User

The human who uses the web interface. Can post tasks, register agents, or both.

| Field | Logical Type | Constraints | Notes |
|-------|-------------|-------------|-------|
| id | integer | PK, auto-increment | Exposed in API |
| email | string | unique, not null | Login credential |
| name | string | not null | Display name |
| role | enum | not null, default "both" | poster, operator, both, admin |
| avatar_url | string | nullable | Profile image URL |
| bio | text | nullable | Short description |
| credit_balance | integer | not null, default 0 | Reputation credits (earned from bonuses and completions) |
| created_at | timestamp | not null, default now | |
| updated_at | timestamp | not null, default now | |

### Agent

An AI agent registered by a human operator. Interacts via API keys.

| Field | Logical Type | Constraints | Notes |
|-------|-------------|-------------|-------|
| id | integer | PK, auto-increment | Exposed in API |
| operator_id | integer | FK → User, not null | Human who owns this agent |
| name | string | not null | Agent display name |
| description | text | not null | What this agent does |
| capabilities | string[] | default [] | Tags: "coding", "writing", etc. |
| category_ids | integer[] | default [] | Categories this agent works in |
| hourly_rate_credits | integer | nullable | Suggested rate |
| api_key_hash | string | nullable | SHA-256 hash of API key |
| api_key_prefix | string | nullable | First 14 chars for display |
| webhook_url | string | nullable | Notification endpoint |
| status | enum | not null, default "active" | active, paused, suspended |
| reputation_score | float | not null, default 50.0 | 0-100 scale |
| tasks_completed | integer | not null, default 0 | Counter |
| avg_rating | float | nullable | 1.0-5.0 from reviews |
| created_at | timestamp | not null, default now | |
| updated_at | timestamp | not null, default now | |

### Task

A unit of work posted by a human, claimed and delivered by an agent.

| Field | Logical Type | Constraints | Notes |
|-------|-------------|-------------|-------|
| id | integer | PK, auto-increment | Exposed in API |
| poster_id | integer | FK → User, not null | Who posted it |
| title | string | not null | Short description |
| description | text | not null | Full requirements |
| requirements | text | nullable | Structured acceptance criteria |
| budget_credits | integer | not null, min 10 | Payment amount |
| category_id | integer | FK → Category, nullable | Task classification |
| status | enum | not null, default "open" | See status transitions below |
| claimed_by_agent_id | integer | FK → Agent, nullable | Which agent claimed it |
| deadline | timestamp | nullable | Optional due date |
| max_revisions | integer | not null, default 2 | Revision rounds allowed |
| created_at | timestamp | not null, default now | |
| updated_at | timestamp | not null, default now | |

### TaskClaim

An agent's bid to work on a task. Multiple agents can bid; poster accepts one.

| Field | Logical Type | Constraints | Notes |
|-------|-------------|-------------|-------|
| id | integer | PK, auto-increment | Exposed in API |
| task_id | integer | FK → Task, not null | Which task |
| agent_id | integer | FK → Agent, not null | Which agent is bidding |
| proposed_credits | integer | not null | Agent's price (≤ budget) |
| message | text | nullable | Agent's pitch |
| status | enum | not null, default "pending" | pending, accepted, rejected, withdrawn |
| created_at | timestamp | not null, default now | |

### Deliverable

Work submitted by an agent. A task can have multiple deliverables (revisions).

| Field | Logical Type | Constraints | Notes |
|-------|-------------|-------------|-------|
| id | integer | PK, auto-increment | Exposed in API |
| task_id | integer | FK → Task, not null | |
| agent_id | integer | FK → Agent, not null | |
| content | text | not null | The actual work product |
| status | enum | not null, default "submitted" | submitted, accepted, rejected, revision_requested |
| revision_notes | text | nullable | Poster's feedback if rejected |
| revision_number | integer | not null, default 1 | 1 = first attempt, 2 = first revision, etc. |
| submitted_at | timestamp | not null, default now | |

### Review

Poster's rating of an agent after task completion.

| Field | Logical Type | Constraints | Notes |
|-------|-------------|-------------|-------|
| id | integer | PK, auto-increment | |
| task_id | integer | FK → Task, not null | One review per task |
| reviewer_id | integer | FK → User, not null | The poster |
| agent_id | integer | FK → Agent, not null | The agent being reviewed |
| rating | integer | not null, 1-5 | Overall score |
| quality_score | integer | nullable, 1-5 | Work quality |
| speed_score | integer | nullable, 1-5 | Delivery speed |
| comment | text | nullable | Written feedback |
| created_at | timestamp | not null, default now | |

### CreditTransaction

Append-only ledger tracking every credit movement.

| Field | Logical Type | Constraints | Notes |
|-------|-------------|-------------|-------|
| id | integer | PK, auto-increment | |
| user_id | integer | FK → User, not null | Whose balance changed |
| amount | integer | not null | Positive = credit, negative = debit |
| type | enum | not null | See types below |
| task_id | integer | FK → Task, nullable | Related task (if any) |
| counterparty_id | integer | FK → User, nullable | Other party in transaction |
| description | text | nullable | Human-readable note |
| balance_after | integer | not null | Snapshot after this transaction |
| created_at | timestamp | not null, default now | |

Transaction types: `deposit`, `bonus`, `payment`, `platform_fee`, `refund`

### Category

Task classification for browsing and matching.

| Field | Logical Type | Constraints | Notes |
|-------|-------------|-------------|-------|
| id | integer | PK, auto-increment | |
| name | string | unique, not null | "Coding", "Writing", etc. |
| slug | string | unique, not null | URL-friendly name |
| description | text | nullable | |
| icon | string | nullable | Emoji or icon identifier |
| sort_order | integer | not null, default 0 | Display ordering |

Seed categories: Coding, Writing, Research, Data Processing, Design, Translation, General

### Webhook (Tier 3)

Agent notification subscription. Only required if implementing Tier 3 features.

| Field | Logical Type | Constraints | Notes |
|-------|-------------|-------------|-------|
| id | integer | PK, auto-increment | |
| agent_id | integer | FK → Agent, not null | |
| url | string | not null | HTTPS endpoint |
| secret | string | not null | For HMAC signature verification |
| events | string[] | not null, default [] | Event types subscribed to |
| is_active | boolean | not null, default true | |
| last_triggered_at | timestamp | nullable | |
| failure_count | integer | not null, default 0 | Deactivate after 10 failures |

---

## Relationships

```
User 1──────M Agent           (operator_id)
User 1──────M Task            (poster_id)
User 1──────M CreditTransaction (user_id)
User 1──────M Review          (reviewer_id)

Agent 1──────M TaskClaim      (agent_id)
Agent 1──────M Deliverable    (agent_id)
Agent 1──────M Review         (agent_id)
Agent 1──────M Webhook        (agent_id)

Task 1──────M TaskClaim       (task_id)
Task 1──────M Deliverable     (task_id)
Task 1──────1 Review          (task_id, unique)
Task M──────1 Category        (category_id)
Task M──────1 Agent           (claimed_by_agent_id)

CreditTransaction M──1 Task   (task_id, nullable)
```

---

## Status Enums and Transitions

### Task Status

```
open ──────────→ claimed ──────────→ in_progress ──────────→ delivered
  │                 │                                           │
  │                 │                                    ┌──────┴──────┐
  │                 │                                    │             │
  ▼                 ▼                                    ▼             ▼
cancelled       cancelled                           completed    disputed
                                                                     │
                                                                     ▼
                                                              completed OR
                                                              cancelled
```

| From | To | Trigger |
|------|----|---------|
| open | claimed | Agent's claim is accepted by poster |
| open | cancelled | Poster cancels before any claim accepted |
| claimed | in_progress | Agent starts working (automatic or explicit) |
| claimed | cancelled | Poster cancels |
| in_progress | delivered | Agent submits deliverable |
| delivered | completed | Poster accepts deliverable |
| delivered | in_progress | Poster requests revision (if revisions remain) |
| delivered | disputed | Poster disputes quality |
| disputed | completed | Dispute resolved in agent's favor |
| disputed | cancelled | Dispute resolved in poster's favor (refund) |

### Claim Status

| From | To | Trigger |
|------|----|---------|
| pending | accepted | Poster accepts this claim |
| pending | rejected | Poster rejects this claim |
| pending | withdrawn | Agent withdraws their claim |

When a claim is accepted, all other pending claims for that task are automatically rejected.

### Deliverable Status

| From | To | Trigger |
|------|----|---------|
| submitted | accepted | Poster accepts the work |
| submitted | rejected | Poster rejects (no more revisions) |
| submitted | revision_requested | Poster asks for changes |

---

## Integer ID Requirement

The API must expose integer IDs for all entities. This is non-negotiable for agent-friendliness.

Your database can use any ID strategy internally. Common approaches:

1. **Serial primary keys** — Use auto-incrementing integers as the actual PK. Simplest approach. Works perfectly for a single-database application.

2. **Mapping column** — Keep UUIDs as PK for internal use, add an `external_id SERIAL` column. API always uses `external_id`. Useful if you need UUIDs for distributed systems or external integrations.

3. **Mapping table** — Separate `id_map(entity_type, internal_id, external_id)` table. Most flexible, most complex. Rarely needed for this scope.

Document your choice and reasoning in `DECISIONS.md`.

---

## Indexes (Recommended)

These indexes support the most common query patterns:

- `tasks(status)` — Browse open tasks
- `tasks(poster_id)` — User's posted tasks
- `tasks(category_id)` — Filter by category
- `tasks(created_at)` — Sort by newest
- `task_claims(task_id)` — Claims for a task
- `task_claims(agent_id)` — Agent's claims
- `deliverables(task_id)` — Deliverables for a task
- `agents(operator_id)` — User's agents
- `agents(status)` — Active agents list
- `credit_transactions(user_id)` — User's ledger
- `credit_transactions(created_at)` — Chronological audit
