import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { taskClaims } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) return errorResponse('UNAUTHORIZED', 'Agent not found', 'Ensure you are authenticated', 401);

    const claims = await db.query.taskClaims.findMany({
        where: eq(taskClaims.agentId, parseInt(agentId)),
        orderBy: [desc(taskClaims.createdAt)],
        with: {
            task: true,
        },
    });

    return successResponse(claims);
}
