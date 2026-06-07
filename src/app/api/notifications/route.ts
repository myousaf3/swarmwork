import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/session';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export async function GET() {
    const { user } = await validateSession();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [items, unreadResult] = await Promise.all([
        db
            .select()
            .from(notifications)
            .where(eq(notifications.userId, user.id))
            .orderBy(desc(notifications.createdAt))
            .limit(20),
        db
            .select({ count: sql<number>`count(*)` })
            .from(notifications)
            .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false))),
    ]);

    return NextResponse.json({
        notifications: items,
        unreadCount: Number(unreadResult[0]?.count ?? 0),
    });
}
