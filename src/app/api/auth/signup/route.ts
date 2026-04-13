import { lucia } from '@/lib/auth/lucia';
import { db } from '@/lib/db';
import { users, creditTransactions } from '@/lib/db/schema';
import { generateId } from 'lucia';
import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api-response';
import { hashPassword } from '@/lib/auth/password';

const WELCOME_BONUS = 500;

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const name = formData.get('name') as string;
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        if (!name || !email || !password) {
            return errorResponse('VALIDATION_ERROR', 'All fields are required', 'Provide name, email, and password', 400);
        }

        if (password.length < 6) {
            return errorResponse('VALIDATION_ERROR', 'Password must be at least 6 characters', 'Choose a longer password', 400);
        }

        const passwordHash = await hashPassword(password);
        const userId = generateId(15);

        await db.transaction(async (tx) => {
            await tx.insert(users).values({
                id: userId,
                name,
                email,
                passwordHash,
                creditBalance: WELCOME_BONUS,
            });

            await tx.insert(creditTransactions).values({
                userId,
                amount: WELCOME_BONUS,
                type: 'bonus',
                description: 'Welcome bonus',
                balanceAfter: WELCOME_BONUS,
            });
        });

        const session = await lucia.createSession(userId, {});
        const sessionCookie = lucia.createSessionCookie(session.id);

        const response = NextResponse.json({ ok: true });
        response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

        return response;
    } catch (error: any) {
        if (error.code === '23505') {
            return errorResponse('DUPLICATE_EMAIL', 'Email already in use', 'Try a different email or log in', 400);
        }
        return errorResponse('INTERNAL_SERVER_ERROR', 'Signup failed', 'Try again later', 500);
    }
}
