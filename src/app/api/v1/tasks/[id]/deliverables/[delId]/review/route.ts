import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks, deliverables, submissionAttempts, agents, users, creditTransactions } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';
import { awardReputationCredits } from '@/lib/credits';
import { withIdempotency } from '@/lib/idempotency';

/**
 * POST /api/v1/tasks/:id/deliverables/:delId/review
 *
 * Submit a review result (pass/fail) for a deliverable.
 * On PASS: auto-completes the task, awards credits, fires webhook.
 * On FAIL: marks deliverable for revision, fires webhook.
 */
export const POST = withIdempotency(async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; delId: string }> },
) {
    try {
        const { id, delId } = await params;
        const taskId = parseInt(id);
        const deliverableId = parseInt(delId);
        const reviewerAgentId = parseInt(request.headers.get('x-agent-id') || '0');

        if (!reviewerAgentId) {
            return errorResponse('UNAUTHORIZED', 'Agent authentication required', 'Provide a valid Bearer token', 401);
        }

        // Parse body
        const body = await request.json();
        const { result, feedback, scores, key_source, llm_model } = body as {
            result: 'pass' | 'fail';
            feedback: string;
            scores?: Record<string, number>;
            key_source?: 'poster' | 'freelancer' | 'none';
            llm_model?: string;
        };

        if (!result || !['pass', 'fail'].includes(result)) {
            return errorResponse('INVALID_INPUT', 'result must be "pass" or "fail"', 'Provide a valid result', 400);
        }
        if (!feedback || typeof feedback !== 'string') {
            return errorResponse('INVALID_INPUT', 'feedback is required', 'Provide feedback text', 400);
        }

        // Fetch task and deliverable
        const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
        if (!task) {
            return errorResponse('TASK_NOT_FOUND', 'Task not found', 'Check task ID', 404);
        }

        const [deliverable] = await db.select().from(deliverables).where(
            and(eq(deliverables.id, deliverableId), eq(deliverables.taskId, taskId)),
        ).limit(1);

        if (!deliverable) {
            return errorResponse('DELIVERABLE_NOT_FOUND', 'Deliverable not found for this task', 'Check deliverable ID', 404);
        }

        // Guard: only review submitted deliverables
        if (deliverable.status !== 'submitted') {
            return errorResponse('INVALID_STATUS', `Deliverable is already ${deliverable.status}`, 'Only submitted deliverables can be reviewed', 409);
        }

        // Guard: self-review prevention — the agent that submitted cannot review its own work
        if (deliverable.agentId === reviewerAgentId) {
            return errorResponse('SELF_REVIEW', 'An agent cannot review its own deliverable', 'Use a different reviewer agent', 403);
        }

        // Guard: duplicate review check
        const [existingAttempt] = await db.select()
            .from(submissionAttempts)
            .where(
                and(
                    eq(submissionAttempts.taskId, taskId),
                    eq(submissionAttempts.agentId, deliverable.agentId),
                    eq(submissionAttempts.attemptNumber, deliverable.revisionNumber),
                ),
            )
            .limit(1);

        if (existingAttempt) {
            return errorResponse('ALREADY_REVIEWED', 'This deliverable has already been reviewed', 'Check submission attempts', 409);
        }

        if (result === 'pass') {
            // --- PASS flow ---
            await db.transaction(async (tx) => {
                // Log submission attempt
                await tx.insert(submissionAttempts).values({
                    taskId,
                    agentId: deliverable.agentId,
                    attemptNumber: deliverable.revisionNumber,
                    content: deliverable.content,
                    reviewResult: 'pass',
                    reviewFeedback: feedback,
                    reviewScores: scores || null,
                    reviewedAt: new Date(),
                    reviewKeySource: key_source || 'none',
                    llmModelUsed: llm_model || null,
                });

                // Accept deliverable
                await tx.update(deliverables)
                    .set({ status: 'accepted' })
                    .where(eq(deliverables.id, deliverableId));

                // Complete task
                await tx.update(tasks)
                    .set({ status: 'completed', posterReviewsUsed: task.posterReviewsUsed + 1, updatedAt: new Date() })
                    .where(eq(tasks.id, taskId));

                // Deduct credits from poster
                const [poster] = await tx.select().from(users).where(eq(users.id, task.posterId)).limit(1);
                if (poster) {
                    const newPosterBalance = poster.creditBalance - task.budgetCredits;
                    await tx.update(users).set({
                        creditBalance: newPosterBalance,
                        updatedAt: new Date(),
                    }).where(eq(users.id, task.posterId));

                    await tx.insert(creditTransactions).values({
                        userId: task.posterId,
                        amount: -task.budgetCredits,
                        type: 'payment',
                        taskId,
                        description: `Task completed: ${task.title}`,
                        balanceAfter: newPosterBalance,
                    });
                }

                // Award credits to the worker agent's operator
                const [agent] = await tx.select().from(agents).where(eq(agents.id, deliverable.agentId)).limit(1);
                if (agent) {
                    await awardReputationCredits(
                        agent.operatorId,
                        agent.id,
                        taskId,
                        task.budgetCredits,
                        `Payment for task ${taskId}: ${task.title}`,
                    );
                }

                // Increment QA Reviewer Bot's reputation and tasks reviewed
                const [reviewerAgent] = await tx.select().from(agents).where(eq(agents.id, reviewerAgentId)).limit(1);
                if (reviewerAgent) {
                    const newRep = Math.min(100, (reviewerAgent.reputationScore ?? 50) + 1);
                    await tx.update(agents).set({
                        tasksCompleted: sql`${agents.tasksCompleted} + 1`,
                        reputationScore: newRep,
                        updatedAt: new Date(),
                    }).where(eq(agents.id, reviewerAgentId));
                }
            });

            // Fire webhooks (non-blocking)
            const { fireWebhook, getOperatorId } = await import('@/lib/webhooks');
            const agentOperatorId = await getOperatorId(deliverable.agentId);
            if (agentOperatorId) {
                fireWebhook(agentOperatorId, 'deliverable.accepted', {
                    task_id: taskId,
                    deliverable_id: deliverableId,
                    agent_id: deliverable.agentId,
                    credits_awarded: task.budgetCredits,
                    task_title: task.title,
                    review_source: 'qa_agent',
                });
                fireWebhook(agentOperatorId, 'deliverable.reviewed', {
                    task_id: taskId,
                    deliverable_id: deliverableId,
                    result: 'pass',
                    key_source: key_source || 'none',
                });

                const { createNotification } = await import('@/lib/notifications');
                createNotification(
                    agentOperatorId,
                    'review.passed',
                    'Review passed',
                    `Your deliverable for "${task.title}" passed QA review. ${task.budgetCredits} credits awarded!`,
                    taskId,
                    `/tasks/${taskId}`,
                );
                createNotification(
                    agentOperatorId,
                    'credits.received',
                    'Credits received',
                    `You earned ${task.budgetCredits} credits for completing "${task.title}"`,
                    taskId,
                    `/dashboard`,
                );
            }

            // Notify poster that task is complete
            const { createNotification: createPosterNotif } = await import('@/lib/notifications');
            createPosterNotif(
                task.posterId,
                'task.completed',
                'Task completed',
                `"${task.title}" has been completed and passed QA review`,
                taskId,
                `/tasks/${taskId}`,
            );

            return successResponse({
                message: 'Review recorded — deliverable accepted, task completed, credits awarded',
                result: 'pass',
                task_id: taskId,
                deliverable_id: deliverableId,
            });
        } else {
            // --- FAIL flow ---
            await db.transaction(async (tx) => {
                // Log submission attempt
                await tx.insert(submissionAttempts).values({
                    taskId,
                    agentId: deliverable.agentId,
                    attemptNumber: deliverable.revisionNumber,
                    content: deliverable.content,
                    reviewResult: 'fail',
                    reviewFeedback: feedback,
                    reviewScores: scores || null,
                    reviewedAt: new Date(),
                    reviewKeySource: key_source || 'none',
                    llmModelUsed: llm_model || null,
                });

                // Mark deliverable for revision with feedback
                await tx.update(deliverables)
                    .set({ status: 'revision_requested', revisionNotes: feedback })
                    .where(eq(deliverables.id, deliverableId));

                // Revert task to in_progress
                await tx.update(tasks)
                    .set({ status: 'in_progress', posterReviewsUsed: task.posterReviewsUsed + 1, updatedAt: new Date() })
                    .where(eq(tasks.id, taskId));
            });

            // Fire webhooks (non-blocking)
            const { fireWebhook, getOperatorId } = await import('@/lib/webhooks');
            const agentOperatorId = await getOperatorId(deliverable.agentId);
            if (agentOperatorId) {
                fireWebhook(agentOperatorId, 'deliverable.revision_requested', {
                    task_id: taskId,
                    deliverable_id: deliverableId,
                    agent_id: deliverable.agentId,
                    feedback,
                    task_title: task.title,
                    review_source: 'qa_agent',
                });
                fireWebhook(agentOperatorId, 'deliverable.reviewed', {
                    task_id: taskId,
                    deliverable_id: deliverableId,
                    result: 'fail',
                    key_source: key_source || 'none',
                });

                const { createNotification } = await import('@/lib/notifications');
                createNotification(
                    agentOperatorId,
                    'review.failed',
                    'Review failed',
                    `Your deliverable for "${task.title}" did not pass QA review. Revision needed.`,
                    taskId,
                    `/tasks/${taskId}`,
                );
            }

            // Notify poster about the failed review
            const { createNotification: createPosterNotif } = await import('@/lib/notifications');
            createPosterNotif(
                task.posterId,
                'review.failed',
                'QA review failed',
                `The deliverable for "${task.title}" did not pass QA review. Revision has been requested.`,
                taskId,
                `/tasks/${taskId}`,
            );

            return successResponse({
                message: 'Review recorded — revision requested',
                result: 'fail',
                feedback,
                task_id: taskId,
                deliverable_id: deliverableId,
            });
        }
    } catch (error) {
        console.error('Review submission error:', error);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to submit review', 'Try again later', 500);
    }
});
