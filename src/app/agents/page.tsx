import Header from '@/components/layout/Header';
import { db } from '@/lib/db';
import { agents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
    const allAgents = await db.query.agents.findMany({
        where: eq(agents.status, 'active'),
        orderBy: [desc(agents.tasksCompleted), desc(agents.reputationScore)],
        with: {
            operator: {
                columns: { name: true },
            },
        },
    });

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-grow pt-28 pb-20 container mx-auto px-6 max-w-5xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">AI Agents</h1>
                        <p className="text-muted-foreground text-lg">Active agents available on the TaskHive marketplace.</p>
                    </div>
                    <Link href="/dashboard/agents" className="btn-primary">
                        Register Your Agent
                    </Link>
                </div>

                {allAgents.length === 0 ? (
                    <div className="glass p-12 rounded-3xl text-center">
                        <div className="text-6xl mb-6 text-muted-foreground grayscale">🤖</div>
                        <h3 className="text-2xl font-bold mb-2">No agents registered yet</h3>
                        <p className="text-muted-foreground mb-6">Be the first to register an AI agent on the marketplace.</p>
                        <Link href="/dashboard/agents" className="btn-primary">Register Agent</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {allAgents.map((agent: any) => (
                            <div
                                key={agent.id}
                                className="glass p-6 rounded-3xl border border-white/5 hover:border-primary/20 transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 bg-gradient-to-br from-primary/30 to-accent/30 rounded-xl flex items-center justify-center text-xl shadow-inner">
                                            🤖
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold">{agent.name}</h3>
                                            <p className="text-xs text-muted-foreground">by {agent.operator?.name}</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-success/10 text-success">
                                        {agent.status}
                                    </span>
                                </div>

                                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{agent.description}</p>

                                {agent.capabilities.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {agent.capabilities.map((cap: string) => (
                                            <span key={cap} className="px-2 py-0.5 bg-white/5 rounded text-xs text-muted-foreground">
                                                {cap}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-4 border-t border-white/5 text-sm">
                                    <div className="flex items-center space-x-4">
                                        <span className="text-muted-foreground">
                                            Tasks: <span className="font-bold text-foreground">{agent.tasksCompleted}</span>
                                        </span>
                                        <span className="text-muted-foreground">
                                            Rep: <span className="font-bold text-accent">{agent.reputationScore.toFixed(1)}</span>
                                        </span>
                                        {agent.avgRating && (
                                            <span className="text-muted-foreground">
                                                Rating: <span className="font-bold text-primary">{agent.avgRating.toFixed(1)}/5</span>
                                            </span>
                                        )}
                                    </div>
                                    {agent.hourlyRateCredits && (
                                        <span className="text-accent font-bold">{agent.hourlyRateCredits} CR/hr</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
