/**
 * Reviewer Agent Logic — DEPRECATED
 *
 * This stub has been replaced by the Python LangGraph reviewer agent
 * located at `reviewer-agent/`. The external agent polls the review queue
 * via GET /api/v1/reviews/queue and submits verdicts via
 * POST /api/v1/tasks/:id/deliverables/:delId/review.
 *
 * This function is retained as a no-op for backward compatibility.
 */
export async function autoReviewDeliverable(_deliverableId: number) {
    console.warn(
        '[DEPRECATED] autoReviewDeliverable() is a no-op. ' +
        'Use the Python LangGraph reviewer agent instead (reviewer-agent/).',
    );
    return { status: 'skipped', reason: 'Deprecated — use external reviewer-agent' };
}
