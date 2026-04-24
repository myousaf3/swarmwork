import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks, categories, users } from '@/lib/db/schema';
import { eq, and, gte, lte, gt, lt, asc, desc, sql } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';
import { withIdempotency } from '@/lib/idempotency';

const postTaskSchema = z.object({
    title: z.string().min(5).max(200),
    description: z.string().min(20).max(5000),
    budget_credits: z.number().int().min(10),
    category_id: z.number().int().optional(),
    deadline: z.string().datetime().optional(),
    max_revisions: z.number().int().min(0).max(5).default(2),
});

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status') || 'open';
        const categoryId = searchParams.get('category');
        const minBudget = searchParams.get('min_budget');
        const maxBudget = searchParams.get('max_budget');
        const sort = searchParams.get('sort') || 'newest';
        const cursor = searchParams.get('cursor');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

        let where = and(eq(tasks.status, status as any));

        if (categoryId) {
            where = and(where, eq(tasks.categoryId, parseInt(categoryId)));
        }
        if (minBudget) {
            where = and(where, gte(tasks.budgetCredits, parseInt(minBudget)));
        }
        if (maxBudget) {
            where = and(where, lte(tasks.budgetCredits, parseInt(maxBudget)));
        }

        // Cursor-based pagination logic (Simplified for this example using ID)
        if (cursor) {
            const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
            if (sort === 'newest') {
                where = and(where, lt(tasks.id, decodedCursor.id));
            } else {
                where = and(where, gt(tasks.id, decodedCursor.id));
            }
        }

        let orderBy = desc(tasks.createdAt);
        if (sort === 'oldest') orderBy = asc(tasks.createdAt);
        if (sort === 'budget_high') orderBy = desc(tasks.budgetCredits);
        if (sort === 'budget_low') orderBy = asc(tasks.budgetCredits);

        const data = await db.query.tasks.findMany({
            where,
            limit: limit + 1,
            orderBy: [orderBy, desc(tasks.id)],
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

        const hasMore = data.length > limit;
        const items = hasMore ? data.slice(0, limit) : data;
        const nextCursor = hasMore
            ? Buffer.from(JSON.stringify({ id: items[items.length - 1].id })).toString('base64')
            : null;

        return successResponse(items, {
            cursor: nextCursor || undefined,
            has_more: hasMore,
            count: items.length,
        });
    } catch (error) {
        return errorResponse('INVALID_PARAMETER', 'Invalid query parameters', 'Check API documentation for valid parameters', 400);
    }
}

export const POST = withIdempotency(async function POST(request: NextRequest) {
    try {
        const agentId = request.headers.get('x-agent-id');
        const operatorId = request.headers.get('x-operator-id');

        if (!operatorId) {
            return errorResponse('UNAUTHORIZED', 'Operator not found', 'Ensure you are authenticated', 401);
        }

        const body = await request.json();
        const result = postTaskSchema.safeParse(body);

        if (!result.success) {
            return errorResponse(
                'VALIDATION_ERROR',
                result.error.issues[0].message,
                'Provide all required fields with correct constraints',
                422
            );
        }

        const [newTask] = await db.insert(tasks).values({
            posterId: operatorId,
            title: result.data.title,
            description: result.data.description,
            budgetCredits: result.data.budget_credits,
            categoryId: result.data.category_id,
            deadline: result.data.deadline ? new Date(result.data.deadline) : null,
            maxRevisions: result.data.max_revisions,
        }).returning();

        return successResponse(newTask);
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to create task', 'Try again later', 500);
    }
});
