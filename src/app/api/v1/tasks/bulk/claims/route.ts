import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks, taskClaims } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';
import { withIdempotency } from '@/lib/idempotency';

const bulkClaimSchema = z.object({
    claims: z.array(z.object({
        task_id: z.number().int(),
        proposed_credits: z.number().int().min(1),
        message: z.string().max(1000).optional(),
    })).max(10),
});

export const POST = withIdempotency(async function POST(request: NextRequest) {
    try {
        const agentId = parseInt(request.headers.get('x-agent-id')!);
        const body = await request.json();
        const result = bulkClaimSchema.safeParse(body);

        if (!result.success) {
            return errorResponse('VALIDATION_ERROR', result.error.issues[0].message, 'Provide an array of claims (max 10)', 422);
        }

        const results = [];
        for (const claimData of result.data.claims) {
            try {
                const taskId = claimData.task_id;
                const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

                if (!task) {
                    results.push({ task_id: taskId, ok: false, error: { code: 'TASK_NOT_FOUND', message: 'Task does not exist' } });
                    continue;
                }

                if (task.status !== 'open') {
                    results.push({ task_id: taskId, ok: false, error: { code: 'TASK_NOT_OPEN', message: `Task is ${task.status}` } });
                    continue;
                }

                if (claimData.proposed_credits > task.budgetCredits) {
                    results.push({ task_id: taskId, ok: false, error: { code: 'INVALID_CREDITS', message: 'Proposed credits exceed budget' } });
                    continue;
                }

                const [existingClaim] = await db.select().from(taskClaims).where(
                    and(
                        eq(taskClaims.taskId, taskId),
                        eq(taskClaims.agentId, agentId),
                        eq(taskClaims.status, 'pending')
                    )
                ).limit(1);

                if (existingClaim) {
                    results.push({ task_id: taskId, ok: false, error: { code: 'DUPLICATE_CLAIM', message: 'Already have a pending claim' } });
                    continue;
                }

                const [newClaim] = await db.insert(taskClaims).values({
                    taskId,
                    agentId,
                    proposedCredits: claimData.proposed_credits,
                    message: claimData.message,
                }).returning();

                results.push({ task_id: taskId, ok: true, claim_id: newClaim.id });
            } catch (err) {
                results.push({ task_id: claimData.task_id, ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process claim' } });
            }
        }

        const summary = {
            succeeded: results.filter(r => r.ok).length,
            failed: results.filter(r => !r.ok).length,
            total: results.length,
        };

        return successResponse({ results, summary });
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to process bulk claims', 'Try again later', 500);
    }
});
