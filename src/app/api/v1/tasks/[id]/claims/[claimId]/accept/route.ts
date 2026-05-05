import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks, taskClaims } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withIdempotency } from '@/lib/idempotency';

export const POST = withIdempotency(async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; claimId: string }> }
) {
    try {
        const { id, claimId: claimIdStr } = await params;
        const taskId = parseInt(id);
        const claimId = parseInt(claimIdStr);
        const operatorId = request.headers.get('x-operator-id')!;

        const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

        if (!task) {
            return errorResponse('TASK_NOT_FOUND', `Task ${taskId} does not exist`, 'Check the task ID', 404);
        }

        if (task.posterId !== operatorId) {
            return errorResponse('FORBIDDEN', 'Only the poster can accept claims', 'Authenticate as the task poster', 403);
        }

        if (task.status !== 'open') {
            return errorResponse('TASK_NOT_OPEN', 'Task is no longer open for claims', 'Check task status', 409);
        }

        const [claim] = await db.select().from(taskClaims).where(eq(taskClaims.id, claimId)).limit(1);

        if (!claim || claim.taskId !== taskId) {
            return errorResponse('CLAIM_NOT_FOUND', 'Claim not found for this task', 'Check claim ID', 404);
        }

        // Transaction to accept one claim and reject others
        await db.transaction(async (tx) => {
            await tx.update(taskClaims).set({ status: 'accepted' }).where(eq(taskClaims.id, claimId));
            await tx.update(taskClaims).set({ status: 'rejected' }).where(
                and(eq(taskClaims.taskId, taskId), ne(taskClaims.id, claimId), eq(taskClaims.status, 'pending'))
            );
            await tx.update(tasks).set({
                status: 'claimed',
                claimedByAgentId: claim.agentId,
                updatedAt: new Date(),
            }).where(eq(tasks.id, taskId));
        });

        const { fireWebhook, getOperatorId } = await import('@/lib/webhooks');
        const agentOperatorId = await getOperatorId(claim.agentId);
        if (agentOperatorId) {
            fireWebhook(agentOperatorId, 'claim.accepted', { task_id: taskId, claim_id: claimId, agent_id: claim.agentId, task_title: task.title });

            const { createNotification } = await import('@/lib/notifications');
            createNotification(
                agentOperatorId,
                'claim.accepted',
                'Your claim was accepted',
                `Your claim on "${task.title}" has been accepted`,
                taskId,
                `/tasks/${taskId}`,
            );
        }

        return successResponse({ message: 'Claim accepted' });
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to accept claim', 'Try again later', 500);
    }
});
