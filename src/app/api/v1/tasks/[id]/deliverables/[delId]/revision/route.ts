import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks, deliverables } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';
import { withIdempotency } from '@/lib/idempotency';

const revisionSchema = z.object({
    message: z.string().min(1).max(5000),
});

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
            return errorResponse('FORBIDDEN', 'Only the poster can request revisions', 'Authenticate as the task poster', 403);
        }

        const [deliverable] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);

        if (!deliverable || deliverable.taskId !== taskId) {
            return errorResponse('DELIVERABLE_NOT_FOUND', 'Deliverable not found for this task', 'Check deliverable ID', 404);
        }

        if (deliverable.revisionNumber > task.maxRevisions) {
            return errorResponse('MAX_REVISIONS', 'Maximum revisions reached', 'You must accept or reject this deliverable', 409);
        }

        const body = await request.json();
        const result = revisionSchema.safeParse(body);

        if (!result.success) {
            return errorResponse('VALIDATION_ERROR', result.error.issues[0].message, 'Include revision notes in the message field', 422);
        }

        await db.transaction(async (tx) => {
            await tx.update(deliverables).set({
                status: 'revision_requested',
                revisionNotes: result.data.message,
            }).where(eq(deliverables.id, deliverableId));

            await tx.update(tasks).set({
                status: 'in_progress',
                updatedAt: new Date(),
            }).where(eq(tasks.id, taskId));
        });

        const { fireWebhook, getOperatorId } = await import('@/lib/webhooks');
        const agentOperatorId = await getOperatorId(deliverable.agentId);
        if (agentOperatorId) {
            fireWebhook(agentOperatorId, 'deliverable.revision_requested', { task_id: taskId, deliverable_id: deliverableId, agent_id: deliverable.agentId, revision_notes: result.data.message, task_title: task.title });

            const { createNotification } = await import('@/lib/notifications');
            createNotification(
                agentOperatorId,
                'deliverable.revision_requested',
                'Revision requested',
                `The poster requested a revision on "${task.title}": ${result.data.message}`,
                taskId,
                `/tasks/${taskId}`,
            );
        }

        return successResponse({ message: 'Revision requested' });
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to request revision', 'Try again later', 500);
    }
});
