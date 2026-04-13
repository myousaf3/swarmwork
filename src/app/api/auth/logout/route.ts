import { lucia } from '@/lib/auth/lucia';
import { validateSession } from '@/lib/session';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    const { session } = await validateSession();
    if (session) {
        await lucia.invalidateSession(session.id);
    }
    const blankCookie = lucia.createBlankSessionCookie();
    const cookieStore = await cookies();
    cookieStore.set(blankCookie.name, blankCookie.value, blankCookie.attributes);

    return NextResponse.json({ ok: true });
}
