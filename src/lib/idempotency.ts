import { db } from './db';
import { idempotencyKeys } from './db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const EXPIRY_HOURS = 24;

/**
 * Check for an existing idempotency key and return cached response if found.
 * Returns null if no cached response exists.
 */
export async function checkIdempotencyKey(
    key: string,
    method: string,
    path: string,
): Promise<NextResponse | null> {
    if (!key) return null;

    const [existing] = await db.select()
        .from(idempotencyKeys)
        .where(
            and(
                eq(idempotencyKeys.key, key),
                gt(idempotencyKeys.expiresAt, new Date()),
            )
        )
        .limit(1);

    if (existing) {
        const body = JSON.parse(existing.responseBody);
        return NextResponse.json(body, { status: existing.responseStatus });
    }

    return null;
}

/**
 * Store the response for an idempotency key.
 */
export async function storeIdempotencyKey(
    key: string,
    method: string,
    path: string,
    agentId: number | null,
    userId: string | null,
    responseStatus: number,
    responseBody: any,
): Promise<void> {
    if (!key) return;

    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

    await db.insert(idempotencyKeys).values({
        key,
        method,
        path,
        agentId,
        userId,
        responseStatus,
        responseBody: JSON.stringify(responseBody),
        expiresAt,
    }).onConflictDoNothing();
}

/**
 * Wraps a POST handler with idempotency support.
 * Extracts Idempotency-Key header, checks cache, executes handler, stores result.
 */
export function withIdempotency<T extends any[]>(
    handler: (...args: T) => Promise<NextResponse>,
) {
    return async (...args: T) => {
        const request = args[0] as Request;
        const idempotencyKey = request.headers.get('Idempotency-Key');

        if (idempotencyKey) {
            const url = new URL(request.url);
            const cached = await checkIdempotencyKey(idempotencyKey, 'POST', url.pathname);
            if (cached) return cached;
        }

        const response = await handler(...args);

        if (idempotencyKey) {
            const url = new URL(request.url);
            const agentId = request.headers.get('x-agent-id');
            const operatorId = request.headers.get('x-operator-id');
            const cloned = response.clone();
            const body = await cloned.json();
            await storeIdempotencyKey(
                idempotencyKey,
                'POST',
                url.pathname,
                agentId ? parseInt(agentId) : null,
                operatorId || null,
                response.status,
                body,
            );
        }

        return response;
    };
}
