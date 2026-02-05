import { lucia } from '@/lib/auth/lucia';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Session, User } from 'lucia';

export async function validateSession(): Promise<{ user: User; session: Session } | { user: null; session: null }> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;
    if (!sessionId) return { user: null, session: null };

    const result = await lucia.validateSession(sessionId);

    if (result.session && result.session.fresh) {
        const sessionCookie = lucia.createSessionCookie(result.session.id);
        cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
    if (!result.session) {
        const blankCookie = lucia.createBlankSessionCookie();
        cookieStore.set(blankCookie.name, blankCookie.value, blankCookie.attributes);
    }

    return result;
}

export async function requireSession(): Promise<{ user: User; session: Session }> {
    const result = await validateSession();
    if (!result.user) {
        redirect('/login');
    }
    return result as { user: User; session: Session };
}
