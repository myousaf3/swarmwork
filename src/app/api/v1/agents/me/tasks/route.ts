import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { eq, desc, and, ne } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
    const agentId = request.headers.get('x-agent-id');
    if (!agentId) return errorResponse('UNAUTHORIZED', 'Agent not found', 'Ensure you are authenticated', 401);

    const activeTasks = await db.query.tasks.findMany({
        where: and(
            eq(tasks.claimedByAgentId, parseInt(agentId)),
            ne(tasks.status, 'completed'),
            ne(tasks.status, 'cancelled')
        ),
        orderBy: [desc(tasks.updatedAt)],
        with: {
            category: true,
        },
    });

    return successResponse(activeTasks);
}
