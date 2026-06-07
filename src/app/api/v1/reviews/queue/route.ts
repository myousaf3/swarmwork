import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { deliverables, tasks, submissionAttempts } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/v1/reviews/queue?limit=20
 *
 * Returns submitted deliverables that have no matching submissionAttempts record.
 * Joins task data needed for the reviewer agent (requirements, auto-review config, etc.).
 * Any authenticated agent can call this.
 */
export async function GET(request: NextRequest) {
    try {
        const agentId = request.headers.get('x-agent-id');
        if (!agentId) {
            return errorResponse('UNAUTHORIZED', 'Agent authentication required', 'Provide a valid Bearer token', 401);
        }

        const limit = Math.min(
            parseInt(request.nextUrl.searchParams.get('limit') || '20'),
            100,
        );

        // Find submitted deliverables with no matching submission attempt
        const queue = await db
            .select({
                deliverable_id: deliverables.id,
                deliverable_content: deliverables.content,
                deliverable_status: deliverables.status,
                deliverable_revision_number: deliverables.revisionNumber,
                deliverable_submitted_at: deliverables.submittedAt,
                agent_id: deliverables.agentId,
                task_id: tasks.id,
                task_title: tasks.title,
                task_description: tasks.description,
                task_requirements: tasks.requirements,
                task_budget_credits: tasks.budgetCredits,
                task_max_revisions: tasks.maxRevisions,
                auto_review_enabled: tasks.autoReviewEnabled,
                poster_llm_provider: tasks.posterLlmProvider,
                poster_llm_key_encrypted: tasks.posterLlmKeyEncrypted,
                poster_max_reviews: tasks.posterMaxReviews,
                poster_reviews_used: tasks.posterReviewsUsed,
            })
            .from(deliverables)
            .innerJoin(tasks, eq(deliverables.taskId, tasks.id))
            .where(
                and(
                    eq(deliverables.status, 'submitted'),
                    sql`NOT EXISTS (
                        SELECT 1 FROM submission_attempts sa
                        WHERE sa.task_id = ${deliverables.taskId}
                          AND sa.agent_id = ${deliverables.agentId}
                          AND sa.attempt_number = ${deliverables.revisionNumber}
                    )`,
                ),
            )
            .orderBy(deliverables.submittedAt)
            .limit(limit);

        // Strip encrypted keys from the response — the agent doesn't need the actual key values
        const items = queue.map((row) => ({
            deliverable_id: row.deliverable_id,
            deliverable_content: row.deliverable_content,
            deliverable_status: row.deliverable_status,
            deliverable_revision_number: row.deliverable_revision_number,
            deliverable_submitted_at: row.deliverable_submitted_at,
            agent_id: row.agent_id,
            task_id: row.task_id,
            task_title: row.task_title,
            task_description: row.task_description,
            task_requirements: row.task_requirements,
            task_budget_credits: row.task_budget_credits,
            task_max_revisions: row.task_max_revisions,
            auto_review_enabled: row.auto_review_enabled,
            poster_llm_provider: row.poster_llm_provider,
            poster_has_llm_key: !!row.poster_llm_key_encrypted,
            poster_max_reviews: row.poster_max_reviews,
            poster_reviews_used: row.poster_reviews_used,
        }));

        return successResponse(items, { count: items.length });
    } catch (error) {
        console.error('Review queue error:', error);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch review queue', 'Try again later', 500);
    }
}
