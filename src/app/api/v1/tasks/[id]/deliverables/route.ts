import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks, deliverables } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';
import { withIdempotency } from '@/lib/idempotency';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const taskId = parseInt(id);

        const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
        if (!task) {
            return errorResponse('TASK_NOT_FOUND', `Task ${taskId} does not exist`, 'Use GET /api/v1/tasks to browse available tasks', 404);
        }

        const taskDeliverables = await db.query.deliverables.findMany({
            where: eq(deliverables.taskId, taskId),
            with: { agent: { columns: { id: true, name: true } } },
            orderBy: [desc(deliverables.submittedAt)],
        });

        return successResponse(taskDeliverables, { count: taskDeliverables.length });
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch deliverables', 'Try again later', 500);
    }
}

const deliverableSchema = z.object({
    content: z.string().min(1).max(50000),
});

export const POST = withIdempotency(async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const taskId = parseInt(id);
        const agentId = parseInt(request.headers.get('x-agent-id')!);

        const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

        if (!task) {
            return errorResponse('TASK_NOT_FOUND', `Task ${taskId} does not exist`, 'Use GET /api/v1/tasks to browse available tasks', 404);
        }

        if (task.claimedByAgentId !== agentId) {
            return errorResponse('NOT_CLAIMED_BY_YOU', `Task ${taskId} is not claimed by your agent`, 'You can only deliver to tasks you have claimed', 403);
        }

        if (task.status !== 'claimed' && task.status !== 'in_progress') {
            return errorResponse(
                'INVALID_STATUS',
                `Task ${taskId} is not in a deliverable state (status: ${task.status})`,
                'Claim the task first or wait for the poster to request revision',
                409
            );
        }

        const body = await request.json();
        const result = deliverableSchema.safeParse(body);

        if (!result.success) {
            return errorResponse(
                'VALIDATION_ERROR',
                result.error.issues[0].message,
                'Include content in request body (string, max 50000 chars)',
                422
            );
        }

        // Get current revision count
        const [lastDeliverable] = await db.select().from(deliverables)
            .where(eq(deliverables.taskId, taskId))
            .orderBy(desc(deliverables.revisionNumber))
            .limit(1);

        const nextRevision = (lastDeliverable?.revisionNumber || 0) + 1;

        if (nextRevision > task.maxRevisions + 1) {
            return errorResponse(
                'MAX_REVISIONS',
                `Maximum revisions reached (${nextRevision - 1} of ${task.maxRevisions + 1} deliveries)`,
                'No more revisions allowed. Contact the poster.',
                409
            );
        }

        // Transaction to create deliverable and update task status
        const [newDeliverable] = await db.transaction(async (tx) => {
            const [del] = await tx.insert(deliverables).values({
                taskId,
                agentId,
                content: result.data.content,
                revisionNumber: nextRevision,
                status: 'submitted',
            }).returning();

            await tx.update(tasks).set({
                status: 'delivered',
                updatedAt: new Date(),
            }).where(eq(tasks.id, taskId));

            return [del];
        });

        // Notify the poster about the new deliverable
        const { createNotification } = await import('@/lib/notifications');
        createNotification(
            task.posterId,
            'deliverable.submitted',
            'New deliverable submitted',
            `A deliverable was submitted for "${task.title}" (revision #${nextRevision})`,
            taskId,
            `/tasks/${taskId}`,
        );

        return successResponse(newDeliverable);
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to submit deliverable', 'Try again later', 500);
    }
});
