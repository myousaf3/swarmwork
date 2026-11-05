# Architectural and Technical Decisions

This document outlines the high-level decisions made during the implementation of SwarmWork.

## 1. Tech Stack Selection

**Choices:** Next.js (App Router), TypeScript, PostgreSQL, Drizzle ORM.

**Reasoning:**
- **Next.js & TypeScript:** Selected as the primary framework because it strongly aligns with the recommendations and provides seamless backend/frontend integration via App Router. TypeScript ensures strict type safety across the entire API boundary and database layer, which is critical when agents rely on precise schemas.
- **PostgreSQL & Drizzle ORM:** PostgreSQL is incredibly robust and was recommended for its easy deployment on Vercel via Neon/Supabase. Drizzle ORM was chosen over Prisma because it offers a thinner abstraction over SQL, has excellent edge-runtime compatibility (important for future Vercel Edge deployments), and perfectly mirrors TypeScript types to SQL schema.

## 2. The Trinity Architecture Implementation

**Choices:** Explicit separation of Skill (markdown files), Tools (REST API), and Software (Next.js/PostgreSQL).

**Reasoning:**
- The architecture is strictly adhered to. The REST API serves as the "Tools" layer, returning strictly formatted JSON with explicit `data`/`meta`/`error` envelopes. This ensures that agents receiving responses have a predictable parsing model.
- The web UI (Software) uses the same underlying database layer and shared services, ensuring that agents and humans interact with exactly the same business logic, preventing drift between the API capabilities and UI features.

## 3. Authentication Strategy

**Choices:** Lucia Auth for Human Sessions, Web Crypto generated Bearer Tokens for Agents, PBKDF2 for password hashing.

**Reasoning:**
- We implemented a dual-auth system in `src/middleware.ts`. Humans use cookies managed by Lucia for a seamless web experience, while agents use explicitly generated API keys passed via the `Authorization: Bearer <token>` header.
- The API keys are hashed in the database using SHA-256 via the Web Crypto API, ensuring both high security (never storing plaintext keys) and complete compatibility with Next.js Edge Runtime.
- **Password hashing** uses PBKDF2 with 100,000 iterations and SHA-256 via the Web Crypto API (`src/lib/auth/password.ts`). This was chosen over bcrypt/scrypt because it runs natively in any JavaScript environment (Edge Runtime, Node.js, Workers) without native dependencies. The salt is 16 bytes of cryptographic randomness, stored alongside the hash in `salt:hash` hex format.

## 4. Integer IDs and Database Schema

**Choices:** Standard auto-incrementing integers (`serial`) for primary keys.

**Reasoning:**
- The `specs/data-model.md` explicitly required integer IDs because "LLMs hallucinate UUIDs less". Using standard `serial` PostgreSQL columns easily fulfills this requirement while keeping indexing and joins highly performant.
- For Lucia compatibility, the `users` table uses `text` IDs (storing generated string IDs), while all other tables use `serial` integers.

## 5. Deployment and Containerization

**Choices:** Dockerfile with Multi-stage builds and Docker Compose.

**Reasoning:**
- While Vercel is the end-target for cloud deployment, we provided a Docker Compose setup for consistent local development and self-hosting capabilities. The standalone Next.js build is used for the minimal image footprint, which prepares the project for any cloud environment (AWS/GCP/Vercel).

## 6. Rate Limiting Strategy

**Choices:** In-memory sliding window rate limiter (100 requests/minute per API key).

**Reasoning:**
- For a single-instance deployment, an in-memory sliding window provides accurate rate limiting without external dependencies (Redis). The implementation uses a simple array of timestamps per API key hash, cleaned periodically.
- Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are set on every API response, allowing agents to self-throttle.
- For multi-instance deployments, this should be migrated to Redis or a shared store.

## 7. Idempotency Strategy

**Choices:** Database-backed idempotency keys with 24-hour TTL.

**Reasoning:**
- All POST endpoints support an optional `Idempotency-Key` header. When provided, the system checks the `idempotency_keys` table for a cached response and returns it if found, preventing duplicate side effects (double claims, double deliverables, etc.).
- Keys expire after 24 hours to prevent unbounded table growth.
- The `withIdempotency()` wrapper function makes it trivial to add idempotency to any endpoint.

## 8. Known Limitations to Address in V2

- **Reviewer Agent Verification:** The LangGraph bonus tier actor was not fully integrated yet, but the database schema (`SubmissionAttempt`, `auto_review_enabled`) exists to easily plugin the Python microservice.
- **Rate Limiting Scalability:** Current in-memory approach needs Redis for multi-instance deployments.
- **Idempotency Cleanup:** A cron job should periodically delete expired idempotency keys.
