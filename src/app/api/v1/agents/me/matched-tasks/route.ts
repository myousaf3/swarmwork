import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { tasks, agents, categories, taskClaims } from '@/lib/db/schema';
import { eq, and, inArray, notInArray, desc } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/v1/agents/me/matched-tasks
 *
 * Returns open tasks that match the calling agent's capabilities/categories.
 * Excludes tasks the agent has already claimed.
 *
 * Matching logic:
 *   1. If agent has categoryIds set → match tasks in those categories
 *   2. If agent has capabilities set → match category slugs against capabilities
 *   3. Always includes uncategorized tasks and "general" tasks
 *
 * This is the endpoint specialized agents poll to auto-discover work.
 */
export async function GET(request: NextRequest) {
    try {
        const agentId = parseInt(request.headers.get('x-agent-id') || '0');
        if (!agentId) {
            return errorResponse('UNAUTHORIZED', 'Agent authentication required', 'Provide a valid Bearer token', 401);
        }

        const limit = Math.min(
            parseInt(request.nextUrl.searchParams.get('limit') || '20'),
            100,
        );

        // Fetch the agent's profile
        const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
        if (!agent) {
            return errorResponse('AGENT_NOT_FOUND', 'Agent not found', 'Check agent ID', 404);
        }

        // Build the set of category IDs this agent is interested in
        let matchedCategoryIds: number[] = [];

        // 1. Direct category IDs on the agent
        if (agent.categoryIds && agent.categoryIds.length > 0) {
            matchedCategoryIds = [...agent.categoryIds];
        }

        // 2. Map capabilities to category slugs
        if (agent.capabilities && agent.capabilities.length > 0) {
            const allCategories = await db.select().from(categories);

            // Split each capability into individual keywords for matching
            // e.g. "web_search" → ["web", "search"], "data_extraction" → ["data", "extraction"]
            const capKeywords = agent.capabilities.flatMap((cap) =>
                cap.toLowerCase().split(/[_\s-]+/),
            );

            for (const cat of allCategories) {
                const slugParts = cat.slug.toLowerCase().split(/[_\s-]+/);
                const nameParts = cat.name.toLowerCase().split(/[_\s-]+/);
                const catKeywords = [...slugParts, ...nameParts];

                // Match if any capability keyword overlaps with any category keyword
                const hasOverlap = capKeywords.some((kw) =>
                    catKeywords.some((ck) => kw === ck || ck.includes(kw) || kw.includes(ck)),
                );

                if (hasOverlap && !matchedCategoryIds.includes(cat.id)) {
                    matchedCategoryIds.push(cat.id);
                }
            }

            // Always include "general" category
            const general = allCategories.find((c) => c.slug === 'general');
            if (general && !matchedCategoryIds.includes(general.id)) {
                matchedCategoryIds.push(general.id);
            }
        }

        // Find task IDs this agent already has pending/accepted claims for
        const existingClaims = await db
            .select({ taskId: taskClaims.taskId })
            .from(taskClaims)
            .where(
                and(
                    eq(taskClaims.agentId, agentId),
                    inArray(taskClaims.status, ['pending', 'accepted']),
                ),
            );
        const claimedTaskIds = existingClaims.map((c) => c.taskId);

        // Query open tasks matching the agent's categories
        const matchedTasks = await db.query.tasks.findMany({
            where: and(
                eq(tasks.status, 'open'),
                matchedCategoryIds.length > 0
                    ? inArray(tasks.categoryId, matchedCategoryIds)
                    : undefined,
                claimedTaskIds.length > 0
                    ? notInArray(tasks.id, claimedTaskIds)
                    : undefined,
            ),
            limit,
            orderBy: [desc(tasks.createdAt)],
            with: {
                category: true,
                poster: {
                    columns: { id: true, name: true },
                },
            },
        });

        return successResponse(matchedTasks, { count: matchedTasks.length });
    } catch (error) {
        console.error('Matched tasks error:', error);
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to fetch matched tasks', 'Try again later', 500);
    }
}
