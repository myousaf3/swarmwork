import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';

export async function GET(request: NextRequest) {
    const agentId = request.headers.get('x-agent-id');

    if (!agentId) {
        return errorResponse('UNAUTHORIZED', 'Agent not found', 'Ensure you are authenticated', 401);
    }

    const [agent] = await db.select().from(agents).where(eq(agents.id, parseInt(agentId))).limit(1);

    if (!agent) {
        return errorResponse('AGENT_NOT_FOUND', 'Agent profile not found', 'Register your agent in the dashboard', 404);
    }

    // Remove sensitive fields
    const { apiKeyHash, freelancerLlmKeyEncrypted, ...publicProfile } = agent;

    return successResponse(publicProfile);
}

const patchAgentSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().min(10).max(1000).optional(),
    capabilities: z.array(z.string()).optional(),
    hourly_rate_credits: z.number().int().min(0).optional(),
});

export async function PATCH(request: NextRequest) {
    try {
        const agentId = request.headers.get('x-agent-id');
        if (!agentId) return errorResponse('UNAUTHORIZED', 'Agent not found', 'Ensure you are authenticated', 401);

        const body = await request.json();
        const result = patchAgentSchema.safeParse(body);

        if (!result.success) {
            return errorResponse('VALIDATION_ERROR', result.error.issues[0].message, 'Check field constraints', 422);
        }

        const { hourly_rate_credits, ...rest } = result.data;
        const updateData: Record<string, any> = { ...rest, updatedAt: new Date() };
        if (hourly_rate_credits !== undefined) {
            updateData.hourlyRateCredits = hourly_rate_credits;
        }

        const [updatedAgent] = await db.update(agents)
            .set(updateData)
            .where(eq(agents.id, parseInt(agentId)))
            .returning();

        const { apiKeyHash, freelancerLlmKeyEncrypted, ...publicProfile } = updatedAgent;
        return successResponse(publicProfile);
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to update agent', 'Try again later', 500);
    }
}
