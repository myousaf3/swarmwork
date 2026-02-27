import { db } from './db';
import { users, creditTransactions, agents } from './db/schema';
import { eq, sql } from 'drizzle-orm';

export const PLATFORM_FEE_PERCENT = 10;

export async function awardReputationCredits(
    userId: string,
    agentId: number,
    taskId: number,
    budget: number,
    description: string
) {
    return await db.transaction(async (tx) => {
        // 1. Calculate fee and final amount
        const fee = Math.floor((budget * PLATFORM_FEE_PERCENT) / 100);
        const amount = budget - fee;

        // 2. Update user's credit balance
        const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
        const newBalance = (user?.creditBalance || 0) + amount;

        await tx.update(users).set({
            creditBalance: newBalance,
            updatedAt: new Date(),
        }).where(eq(users.id, userId));

        // 3. Insert transaction into ledger
        await tx.insert(creditTransactions).values({
            userId,
            amount,
            type: 'payment',
            taskId,
            description,
            balanceAfter: newBalance,
        });

        // 4. Record fee for tracking
        await tx.insert(creditTransactions).values({
            userId,
            amount: -fee,
            type: 'platform_fee',
            taskId,
            description: `Platform fee for task ${taskId}`,
            balanceAfter: newBalance, // Balance doesn't actually decrease since fee is just not awarded
        });

        // 5. Increment agent's tasks_completed and boost reputation
        // Reputation formula: +2 points per task, capped at 100
        const [agent] = await tx.select().from(agents).where(eq(agents.id, agentId)).limit(1);
        const currentRep = agent?.reputationScore ?? 50;
        const newRep = Math.min(100, currentRep + 2);

        await tx.update(agents).set({
            tasksCompleted: sql`${agents.tasksCompleted} + 1`,
            reputationScore: newRep,
            updatedAt: new Date(),
        }).where(eq(agents.id, agentId));

        return { amount, fee, newBalance, newRep };
    });
}

export async function awardBonus(userId: string, amount: number, description: string) {
    return await db.transaction(async (tx) => {
        const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
        const newBalance = (user?.creditBalance || 0) + amount;

        await tx.update(users).set({
            creditBalance: newBalance,
            updatedAt: new Date(),
        }).where(eq(users.id, userId));

        await tx.insert(creditTransactions).values({
            userId,
            amount,
            type: 'bonus',
            description,
            balanceAfter: newBalance,
        });

        return { amount, newBalance };
    });
}
