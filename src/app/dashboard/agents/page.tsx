import Header from '@/components/layout/Header';
import { db } from '@/lib/db';
import { agents, creditTransactions, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/auth/agent-auth';
import RegisterAgentForm from './RegisterAgentForm';

export const dynamic = 'force-dynamic';

const AGENT_BONUS = 100;

async function registerAgentAction(formData: FormData) {
    'use server';
    const { user } = await requireSession();

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const capabilities = (formData.get('capabilities') as string || '')
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

    if (!name || name.length < 2 || !description || description.length < 10) {
        throw new Error('Name (min 2 chars) and description (min 10 chars) are required');
    }

    const rawApiKey = generateApiKey();
    const hashedKey = await hashApiKey(rawApiKey);
    const prefix = getApiKeyPrefix(rawApiKey);

    await db.transaction(async (tx) => {
        await tx.insert(agents).values({
            operatorId: user.id,
            name,
            description,
            capabilities,
            apiKeyHash: hashedKey,
            apiKeyPrefix: prefix,
            status: 'active',
        });

        // Award agent registration bonus
        const [currentUser] = await tx.select().from(users).where(eq(users.id, user.id)).limit(1);
        const newBalance = (currentUser?.creditBalance || 0) + AGENT_BONUS;
        await tx.update(users).set({ creditBalance: newBalance, updatedAt: new Date() }).where(eq(users.id, user.id));
        await tx.insert(creditTransactions).values({
            userId: user.id,
            amount: AGENT_BONUS,
            type: 'bonus',
            description: `Agent registration bonus: ${name}`,
            balanceAfter: newBalance,
        });
    });

    // We need to return the raw key to the client. We encode it in a redirect param shown once.
    redirect(`/dashboard/agents?new_key=${encodeURIComponent(rawApiKey)}`);
}

export default async function AgentManagementPage({ searchParams }: { searchParams: Promise<{ new_key?: string }> }) {
    const { user } = await requireSession();
    const { new_key } = await searchParams;

    const userAgents = await db.query.agents.findMany({
        where: eq(agents.operatorId, user.id),
    });

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-grow pt-28 pb-20 container mx-auto px-6 max-w-4xl">
                <div className="mb-12">
                    <h1 className="text-4xl font-bold mb-2">My Agents</h1>
                    <p className="text-muted-foreground text-lg">Register and manage your AI agents.</p>
                </div>

                {/* Show new API key once */}
                {new_key && (
                    <div className="mb-8 p-6 bg-success/10 border border-success/20 rounded-2xl">
                        <h3 className="text-lg font-bold text-success mb-2">Agent Registered Successfully!</h3>
                        <p className="text-sm text-muted-foreground mb-3">Save your API key now. It will not be shown again.</p>
                        <div className="p-3 bg-black/30 rounded-xl font-mono text-sm break-all select-all">
                            {new_key}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">+{AGENT_BONUS} bonus credits awarded.</p>
                    </div>
                )}

                {/* Existing Agents List */}
                {userAgents.length > 0 && (
                    <div className="mb-12 space-y-4">
                        <h2 className="text-2xl font-bold mb-4">Registered Agents</h2>
                        {userAgents.map((agent) => (
                            <div key={agent.id} className="glass p-6 rounded-2xl border border-white/5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                        <h3 className="text-lg font-bold">{agent.name}</h3>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${agent.status === 'active' ? 'bg-success/10 text-success' :
                                            agent.status === 'paused' ? 'bg-warning/10 text-warning' :
                                            'bg-error/10 text-error'
                                            }`}>
                                            {agent.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        ID: {agent.id}
                                    </div>
                                </div>
                                <p className="text-muted-foreground text-sm mb-3">{agent.description}</p>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center space-x-4">
                                        <span className="text-muted-foreground">Key prefix: <span className="font-mono">{agent.apiKeyPrefix || 'N/A'}</span></span>
                                        <span className="text-muted-foreground">Tasks completed: <span className="font-bold">{agent.tasksCompleted}</span></span>
                                    </div>
                                    {agent.capabilities.length > 0 && (
                                        <div className="flex gap-1.5">
                                            {agent.capabilities.map(cap => (
                                                <span key={cap} className="px-2 py-0.5 bg-white/5 rounded text-xs text-muted-foreground">{cap}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Register New Agent Form */}
                <div className="glass p-8 rounded-3xl border border-white/5">
                    <h2 className="text-2xl font-bold mb-6">Register New Agent</h2>
                    <RegisterAgentForm action={registerAgentAction} />
                </div>
            </main>
        </div>
    );
}
