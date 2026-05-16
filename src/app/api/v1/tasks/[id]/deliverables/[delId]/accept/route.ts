import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks, deliverables, agents, users, creditTransactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';
import { awardReputationCredits } from '@/lib/credits';
import { withIdempotency } from '@/lib/idempotency';

export const POST = withIdempotency(async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; delId: string }> }
) {
    try {
        const { id, delId } = await params;
        const taskId = parseInt(id);
        const deliverableId = parseInt(delId);
        const operatorId = request.headers.get('x-operator-id')!;

        const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

        if (!task || task.posterId !== operatorId) {
            return errorResponse('FORBIDDEN', 'Only the poster can accept deliverables', 'Authenticate as the task poster', 403);
        }

        const [deliverable] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);

        if (!deliverable || deliverable.taskId !== taskId) {
            return errorResponse('DELIVERABLE_NOT_FOUND', 'Deliverable not found for this task', 'Check deliverable ID', 404);
        }

        if (deliverable.status !== 'submitted') {
            return errorResponse('INVALID_STATUS', `Deliverable is already ${deliverable.status}`, 'Check deliverable status', 409);
        }

        // Accept deliverable and award credits
        await db.transaction(async (tx) => {
            await tx.update(deliverables).set({ status: 'accepted' }).where(eq(deliverables.id, deliverableId));
            await tx.update(tasks).set({
                status: 'completed',
                updatedAt: new Date(),
            }).where(eq(tasks.id, taskId));

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

            // Award credits to the agent's operator
            const [agent] = await tx.select().from(agents).where(eq(agents.id, deliverable.agentId)).limit(1);
            if (agent) {
                await awardReputationCredits(
                    agent.operatorId,
                    agent.id,
                    taskId,
                    task.budgetCredits,
                    `Payment for task ${taskId}: ${task.title}`
                );
            }
        });

        const { fireWebhook, getOperatorId } = await import('@/lib/webhooks');
        const agentOperatorId = await getOperatorId(deliverable.agentId);
        if (agentOperatorId) {
            fireWebhook(agentOperatorId, 'deliverable.accepted', { task_id: taskId, deliverable_id: deliverableId, agent_id: deliverable.agentId, credits_awarded: task.budgetCredits, task_title: task.title });

            const { createNotification } = await import('@/lib/notifications');
            createNotification(
                agentOperatorId,
                'deliverable.accepted',
                'Deliverable accepted',
                `Your deliverable for "${task.title}" was accepted. ${task.budgetCredits} credits awarded!`,
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

        return successResponse({ message: 'Deliverable accepted and reputation awarded' });
    } catch (error) {
        console.error(error);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to accept deliverable', 'Try again later', 500);
    }
});
