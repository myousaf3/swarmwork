import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { creditTransactions, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
    const operatorId = request.headers.get('x-operator-id');
    if (!operatorId) return errorResponse('UNAUTHORIZED', 'Operator not found', 'Ensure you are authenticated', 401);

    const [user] = await db.select({
        creditBalance: users.creditBalance
    }).from(users).where(eq(users.id, operatorId)).limit(1);

    const recent_transactions = await db.query.creditTransactions.findMany({
        where: eq(creditTransactions.userId, operatorId),
        orderBy: [desc(creditTransactions.createdAt)],
        limit: 50,
    });

    return successResponse({
        creditBalance: user?.creditBalance || 0,
        recent_transactions,
    });
}
