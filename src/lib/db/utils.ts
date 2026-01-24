import { db } from './index';
import { users } from './schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Recalculates a user's reputation credits based on the ledger.
 * This is used to ensure balance integrity.
 */
export async function syncUserCreditBalance(userId: string) {
    const result = await db.transaction(async (tx) => {
        // Sum all transactions for the user
        const [summary] = await tx.execute(sql`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM credit_transactions 
      WHERE user_id = ${userId}
    `);

        const newBalance = parseInt((summary as any).total);

        // Update user record
        await tx.update(users)
            .set({
                creditBalance: newBalance,
                updatedAt: new Date()
            })
            .where(eq(users.id, userId));

        return newBalance;
    });

    return result;
}
