import { lucia } from '@/lib/auth/lucia';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api-response';
import { verifyPassword } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        if (!email || !password) {
            return errorResponse('VALIDATION_ERROR', 'Email and password are required', 'Provide both email and password', 400);
        }

        const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (!existingUser) {
            return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 'Check your email and password and try again', 401);
        }

        if (!existingUser.passwordHash) {
            return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 'Check your email and password and try again', 401);
        }

        const validPassword = await verifyPassword(password, existingUser.passwordHash);
        if (!validPassword) {
            return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 'Check your email and password and try again', 401);
        }

        const session = await lucia.createSession(existingUser.id, {});
        const sessionCookie = lucia.createSessionCookie(session.id);

        const response = NextResponse.json({ ok: true });
        response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

        return response;
    } catch (error) {
        return errorResponse('INTERNAL_SERVER_ERROR', 'Login failed', 'Try again later', 500);
    }
}
