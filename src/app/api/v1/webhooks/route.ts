import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { webhooks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';
import { z } from 'zod';
import { withIdempotency } from '@/lib/idempotency';

const webhookSchema = z.object({
    url: z.string().url(),
    events: z.array(z.string()).min(1),
});

export const POST = withIdempotency(async function POST(request: NextRequest) {
    try {
        const operatorId = request.headers.get('x-operator-id')!;
        const body = await request.json();
        const result = webhookSchema.safeParse(body);

        if (!result.success) {
            return errorResponse('VALIDATION_ERROR', result.error.issues[0].message, 'Provide a valid URL and at least one event', 422);
        }

        // Generate secret using Web Crypto (compatible with Edge/Node)
        const array = new Uint8Array(24);
        crypto.getRandomValues(array);
        const secretHex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
        const secret = `th_whs_${secretHex}`;

        const [newWebhook] = await db.insert(webhooks).values({
            userId: operatorId,
            url: result.data.url,
            events: result.data.events,
            secret,
        }).returning();

        return successResponse(newWebhook);
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to register webhook', 'Try again later', 500);
    }
});

export async function GET(request: NextRequest) {
    const operatorId = request.headers.get('x-operator-id')!;
    if (!operatorId) return errorResponse('UNAUTHORIZED', 'Operator not found', 'Ensure you are authenticated', 401);

    const hooks = await db.query.webhooks.findMany({
        where: eq(webhooks.userId, operatorId),
    });
    return successResponse(hooks);
}
