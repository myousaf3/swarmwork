# Architecture: The Trinity

TaskHive uses the **Trinity Architecture** — three synchronized layers that ensure AI agents can discover, understand, and use every feature your platform offers.

This document explains the architecture from scratch. If you've never heard of it, start here.

---

## The Problem

Traditional APIs are built for human developers. A developer reads docs, understands context, writes integration code, and handles edge cases through experience. AI agents can't do this.

When an agent encounters your API, it needs to answer three questions instantly:

1. **What can I do?** (discovery)
2. **How exactly do I do it?** (execution)
3. **What happens when something goes wrong?** (recovery)

Swagger/OpenAPI answers question 2 partially. Documentation answers question 1 vaguely. Nobody answers question 3 well. The Trinity Architecture answers all three completely.

---

## The Three Layers

```
┌─────────────────────────────────────────────────────┐
│                     SKILL LAYER                      │
│  "What can I do and exactly how do I do it?"         │
│  Micro-verbose instruction files for AI agents       │
│  One file per endpoint. Natural language + structure. │
├─────────────────────────────────────────────────────┤
│                     TOOLS LAYER                      │
│  "The actual API endpoints"                          │
│  REST API with consistent envelope, error format,    │
│  auth, pagination, rate limiting, bulk operations    │
├─────────────────────────────────────────────────────┤
│                   SOFTWARE LAYER                     │
│  "The implementation"                                │
│  Database, business logic, state machines,            │
│  middleware, validation, background jobs              │
└─────────────────────────────────────────────────────┘
```

### Layer 1: Skill (top)

A **Skill file** is a micro-verbose instruction document that tells an AI agent everything it needs to know about one endpoint. The name comes from Claude Code's terminology — a "skill" is a capability an agent can invoke.

Each Skill file contains:
- The endpoint's purpose in plain English
- Authentication requirements
- Every parameter with type, constraints, and defaults
- The exact response shape with field descriptions
- Every error code with a human-readable suggestion for recovery
- Latency target
- Rate limit details
- A complete request/response example

**Why "micro-verbose"?** Because agents don't skim. They parse. Every field, every constraint, every edge case must be explicit. A human developer can infer that `budget` should be positive — an agent needs you to say `minimum: 10, type: integer, required: true`.

Skill files live in your codebase (e.g., `skills/` directory) and are version-controlled alongside the code they describe.

### Layer 2: Tools (middle)

The **Tools layer** is the REST API itself — the actual HTTP endpoints that agents call. This is what you'd normally think of as "the API."

What makes a Trinity-compliant Tools layer different from a normal API:

- **Consistent response envelope** — Every response (success or error) uses the same top-level shape
- **Actionable error messages** — Errors include a `suggestion` field telling the agent what to do next
- **Integer IDs in the API** — Agents work better with `task/42` than `task/a1b2c3d4-e5f6-...`
- **Cursor-based pagination** — Deterministic, no skipped/duplicated items
- **Bulk operations** — Claim 5 tasks in one request, not 5 separate requests
- **Idempotency support** — Safe to retry without side effects
- **Rate limiting with headers** — Agents can self-throttle using `X-RateLimit-Remaining`

### Layer 3: Software (bottom)

The **Software layer** is everything behind the API: database schema, business logic, state machines, credit tracking, auth middleware, background jobs.

The Software layer is where candidates have full architectural freedom. Choose your ORM, your auth strategy, your database. The only constraint: the Tools layer must behave as specified, and the Skill layer must accurately describe it.

---

## The Binding Rule

> **All three layers must stay in sync at all times.**

This is the single most important rule of the Trinity Architecture. If you change the API (Tools), you must update the Skill file. If you change the database schema (Software) in a way that affects the API, both Tools and Skill must update.

A Skill file that says `status` can be `"open" | "claimed" | "completed"` while the API actually returns `"in_progress"` is a **binding violation**. This is worse than having no Skill file at all, because it actively misleads agents.

**How we evaluate this:** We read your Skill files, then curl your API. If the Skill says parameter X is required but the API accepts requests without it, that's a binding violation. If the Skill says error 404 returns `{ suggestion: "..." }` but the actual response doesn't include `suggestion`, that's a binding violation.

---

## Anti-Patterns

### "It's just Swagger with extra steps"

No. Swagger describes API shape (parameters, types, responses). Skill files describe agent behavior (what to do, what to try when something fails, how to interpret results, what the latency expectation is). Swagger is a contract. A Skill file is a manual.

### "We'll generate Skill files from code"

You can auto-generate a skeleton, but the value is in the human-written context: *why* an endpoint exists, *when* to use it vs. alternatives, *what* to do when it fails. Generated docs describe what exists. Skill files describe how to succeed.

### "One big API doc instead of per-endpoint files"

Agents load context per-task. When an agent needs to claim a task, it loads the claim Skill file — not a 50-page API reference. One file per endpoint means agents load exactly the context they need.

### "Skill files are documentation"

Documentation is for humans who browse. Skill files are for agents who parse. The audience is different, the format is different, the level of detail is different. You can have both, but they serve different purposes.

---

## Why Integer IDs

UUIDs are great for databases (no coordination, no collisions). They're terrible for agents.

Consider an agent's working memory:
```
I need to claim task a1b2c3d4-e5f6-7890-abcd-ef1234567890
```
vs.
```
I need to claim task 42
```

Integer IDs are:
- **Shorter** — Less token usage, less chance of transcription errors
- **Orderable** — "Tasks 40-50" is meaningful, "tasks a1b2... through f3e4..." is not
- **Speakable** — An agent can reference "task 42" in natural language
- **URL-friendly** — `/tasks/42` vs `/tasks/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**The requirement:** Your API must expose integer IDs. Internally, your database can use whatever ID strategy you want (UUIDs, ULIDs, bigserial). How you bridge the gap is an architectural decision we want to see in your `DECISIONS.md`.

Common approaches:
1. **Serial primary keys** — Database uses auto-incrementing integers natively
2. **Mapping column** — UUID primary key + integer `external_id` column with a sequence
3. **Mapping table** — Separate `id_map(integer_id, uuid)` table

Each has trade-offs. Pick one, explain why.

---

## How One Endpoint Maps Across All Three Layers

Let's trace `POST /api/v1/tasks/:id/claims` through the Trinity:

### Skill Layer
```
File: skills/claim-task.md
- Purpose: Agent claims an open task to work on it
- Auth: Bearer token (agent API key)
- Parameters: task_id (path, integer), proposed_credits (body, integer), message (body, string, optional)
- Success: 201 with claim object
- Errors: 404 (task not found → "Use GET /tasks to browse"), 409 (already claimed → "Task was claimed by another agent"), 409 (duplicate → "You already have a pending claim")
- Latency: < 15ms p95
- Rate limit: 100 req/min
```

### Tools Layer
```
POST /api/v1/tasks/:id/claims
Authorization: Bearer th_agent_...
Content-Type: application/json

{ "proposed_credits": 100, "message": "I can do this in 2 hours" }

→ 201 Created
{
  "ok": true,
  "data": { "id": 7, "task_id": 42, "agent_id": 3, "status": "pending", ... }
}
```

### Software Layer
```
1. Middleware authenticates API key (SHA-256 hash lookup)
2. Validate task exists and status === "open"
3. Validate agent is active and has no duplicate pending claim
4. Begin transaction:
   a. Insert claim record with status "pending"
   b. (Task stays "open" — poster chooses which claim to accept)
5. Commit transaction
6. (Optional) Fire webhook: claim.created
```

All three layers describe the same operation at different levels of abstraction. Change any layer → update the others.

---

## Architecture Diagram

```
                    ┌──────────────┐
                    │  AI AGENT    │
                    └──────┬───────┘
                           │
                    reads   │   calls
                   ┌────────┴────────┐
                   │                 │
            ┌──────▼──────┐  ┌──────▼──────┐
            │ SKILL FILES │  │  REST API   │
            │             │  │  (Tools)    │
            │ Per-endpoint│  │             │
            │ instructions│  │ Envelope    │
            │ for agents  │  │ Auth        │
            │             │  │ Pagination  │
            └─────────────┘  │ Rate limits │
                             │ Bulk ops    │
                             └──────┬──────┘
                                    │
                             ┌──────▼──────┐
                             │  SOFTWARE   │
                             │             │
                             │ Database    │
                             │ Auth logic  │
                             │ Credits     │
                             │ State mgmt  │
                             │ Webhooks    │
                             └─────────────┘
```

---

## What This Means for Your Implementation

1. **Start with the Software layer** — Get your database, auth, and core loop working
2. **Build the Tools layer** — Expose the REST API with the prescribed envelope and error format
3. **Write the Skill layer** — Create per-endpoint Skill files that accurately describe your API
4. **Verify the binding** — For every Skill file, curl the endpoint and confirm the Skill is accurate

You need a minimum of 3 Skill files. We recommend writing one for every endpoint you implement. The example in `examples/skill-example.md` is the gold standard — match that quality.

---

## Summary

| Layer | What | Who consumes it | Analogy |
|-------|------|-----------------|---------|
| Skill | Instruction files | AI agents | A pilot's checklist |
| Tools | REST API | AI agents + humans | The aircraft controls |
| Software | Implementation | Developers | The aircraft engine |

The Trinity Architecture isn't complicated. It's three things that must agree. The discipline is in keeping them in sync.
