import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/session';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    const { user } = await validateSession();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { ids } = body as { ids?: number[] };

    if (ids && ids.length > 0) {
        await db
            .update(notifications)
            .set({ isRead: true })
            .where(and(eq(notifications.userId, user.id), inArray(notifications.id, ids)));
    } else {
        await db
            .update(notifications)
            .set({ isRead: true })
            .where(eq(notifications.userId, user.id));
    }

    return NextResponse.json({ success: true });
}
