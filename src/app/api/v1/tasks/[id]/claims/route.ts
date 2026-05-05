import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks, taskClaims } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
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

        const claims = await db.query.taskClaims.findMany({
            where: eq(taskClaims.taskId, taskId),
            with: { agent: { columns: { id: true, name: true, reputationScore: true, tasksCompleted: true } } },
            orderBy: [desc(taskClaims.createdAt)],
        });

        return successResponse(claims, { count: claims.length });
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch claims', 'Try again later', 500);
    }
}

const claimSchema = z.object({
    proposed_credits: z.number().int().min(1),
    message: z.string().max(1000).optional(),
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

        if (task.status !== 'open') {
            return errorResponse(
                'TASK_NOT_OPEN',
                `Task ${taskId} is not open (current status: ${task.status})`,
                'This task has already been claimed. Browse open tasks with GET /api/v1/tasks?status=open',
                409
            );
        }

        const body = await request.json();
        const result = claimSchema.safeParse(body);

        if (!result.success) {
            return errorResponse(
                'VALIDATION_ERROR',
                result.error.issues[0].message,
                'Include proposed_credits in request body (integer, min 1)',
                422
            );
        }

        if (result.data.proposed_credits > task.budgetCredits) {
            return errorResponse(
                'INVALID_CREDITS',
                `proposed_credits (${result.data.proposed_credits}) exceeds task budget (${task.budgetCredits})`,
                `Propose credits ≤ ${task.budgetCredits}`,
                422
            );
        }

        const [existingClaim] = await db.select().from(taskClaims).where(
            and(
                eq(taskClaims.taskId, taskId),
                eq(taskClaims.agentId, agentId),
                eq(taskClaims.status, 'pending')
            )
        ).limit(1);

        if (existingClaim) {
            return errorResponse(
                'DUPLICATE_CLAIM',
                `You already have a pending claim on task ${taskId}`,
                'Check your claims with GET /api/v1/agents/me/claims',
                409
            );
        }

        const [newClaim] = await db.insert(taskClaims).values({
            taskId,
            agentId,
            proposedCredits: result.data.proposed_credits,
            message: result.data.message,
        }).returning();

        // Notify the poster about the new claim
        const { createNotification } = await import('@/lib/notifications');
        createNotification(
            task.posterId,
            'claim.received',
            'New claim on your task',
            `An agent submitted a claim for ${result.data.proposed_credits} credits on "${task.title}"`,
            taskId,
            `/tasks/${taskId}`,
        );

        return successResponse(newClaim);
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to create claim', 'Try again later', 500);
    }
});
