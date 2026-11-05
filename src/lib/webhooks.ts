import { db } from './db';
import { webhooks, agents } from './db/schema';
import { eq, and, sql } from 'drizzle-orm';

export type WebhookEvent =
    | 'claim.accepted'
    | 'claim.rejected'
    | 'deliverable.accepted'
    | 'deliverable.revision_requested'
    | 'deliverable.reviewed'
    | 'task.cancelled';

interface WebhookPayload {
    event: WebhookEvent;
    timestamp: string;
    data: Record<string, unknown>;
}

async function signPayload(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Fire webhooks for a given operator (user) and event.
 * Non-blocking — errors are caught and logged, never thrown to the caller.
 */
export async function fireWebhook(
    operatorId: string,
    event: WebhookEvent,
    data: Record<string, unknown>,
) {
    try {
        const hooks = await db.query.webhooks.findMany({
            where: and(
                eq(webhooks.userId, operatorId),
                eq(webhooks.isActive, true),
            ),
        });

        const matching = hooks.filter((h) => h.events.includes(event));
        if (matching.length === 0) return;

        const payload: WebhookPayload = {
            event,
            timestamp: new Date().toISOString(),
            data,
        };
        const body = JSON.stringify(payload);

        await Promise.allSettled(
            matching.map(async (hook) => {
                try {
                    const signature = await signPayload(body, hook.secret);

                    const res = await fetch(hook.url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-SwarmWork-Event': event,
                            'X-SwarmWork-Signature': signature,
                            'X-SwarmWork-Timestamp': payload.timestamp,
                        },
                        body,
                        signal: AbortSignal.timeout(10_000),
                    });

                    if (res.ok) {
                        // Reset failure count on success
                        await db
                            .update(webhooks)
                            .set({ lastTriggeredAt: new Date(), failureCount: 0 })
                            .where(eq(webhooks.id, hook.id));
                    } else {
                        await incrementFailure(hook.id, hook.failureCount);
                    }
                } catch {
                    await incrementFailure(hook.id, hook.failureCount);
                }
            }),
        );
    } catch {
        // Never let webhook failures propagate
    }
}

/**
 * Increment failure count. Deactivate after 10 consecutive failures.
 */
async function incrementFailure(hookId: number, currentCount: number) {
    const newCount = currentCount + 1;
    await db
        .update(webhooks)
        .set({
            failureCount: newCount,
            isActive: newCount >= 10 ? false : undefined,
            lastTriggeredAt: new Date(),
        })
        .where(eq(webhooks.id, hookId));
}

/**
 * Helper: resolve an agentId to its operatorId.
 */
export async function getOperatorId(agentId: number): Promise<string | null> {
    const [agent] = await db
        .select({ operatorId: agents.operatorId })
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);
    return agent?.operatorId ?? null;
}
