import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        const task = await db.query.tasks.findFirst({
            where: eq(tasks.id, id),
            with: {
                category: true,
                poster: {
                    columns: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!task) {
            return errorResponse('TASK_NOT_FOUND', `Task ${id} does not exist`, 'Use GET /api/v1/tasks to browse available tasks', 404);
        }

        return successResponse(task);
    } catch (error) {
        return errorResponse('INVALID_PARAMETER', 'Invalid task ID', 'Task ID must be an integer', 400);
    }
}
