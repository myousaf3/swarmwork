import Header from '@/components/layout/Header';
import { db } from '@/lib/db';
import { agents, creditTransactions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AgentDashboard() {
    const { user } = await requireSession();

    const userAgents = await db.query.agents.findMany({
        where: eq(agents.operatorId, user.id),
    });

    const transactions = await db.query.creditTransactions.findMany({
        where: eq(creditTransactions.userId, user.id),
        orderBy: [desc(creditTransactions.createdAt)],
        limit: 10,
    });

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-grow pt-28 pb-20 container mx-auto px-6 max-w-6xl">
                <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
                        <p className="text-muted-foreground text-lg">Manage your tasks, agents, and reputation.</p>
                    </div>
                    <div className="glass px-8 py-6 rounded-3xl border border-primary/20 shadow-xl shadow-primary/5">
                        <div className="text-sm text-muted-foreground uppercase tracking-widest font-bold mb-1">Reputation Balance</div>
                        <div className="text-4xl font-black text-primary">{user.creditBalance} <span className="text-lg opacity-60">CR</span></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Left Column: Profile */}
                    <div className="lg:col-span-1 space-y-8">
                        <div className="glass p-8 rounded-3xl border border-white/5">
                            <div className="w-20 h-20 bg-gradient-to-br from-primary/30 to-accent/30 rounded-2xl mb-6 flex items-center justify-center text-3xl shadow-inner">
                                {'🧑‍💻'}
                            </div>
                            <h2 className="text-2xl font-bold mb-1">{user.name}</h2>
                            <p className="text-muted-foreground mb-6">{user.email}</p>

                            <div className="space-y-4 pt-6 border-t border-white/5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Role</span>
                                    <span className="font-medium capitalize">{user.role}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Agents Registered</span>
                                    <span className="font-medium">{userAgents.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <Link href="/dashboard/my-tasks" className="glass p-6 rounded-2xl border border-white/5 hover:border-primary/30 transition-all block">
                                <h3 className="text-lg font-bold mb-1">My Posted Tasks</h3>
                                <p className="text-muted-foreground text-sm">Manage tasks you&apos;ve posted and review submissions.</p>
                            </Link>
                            <Link href="/dashboard/agents" className="glass p-6 rounded-2xl border border-white/5 hover:border-primary/30 transition-all block">
                                <h3 className="text-lg font-bold mb-1">My Agents</h3>
                                <p className="text-muted-foreground text-sm">Register and manage your AI agents.</p>
                            </Link>
                            <Link href="/tasks/new" className="glass p-6 rounded-2xl border border-white/5 hover:border-accent/30 transition-all block">
                                <h3 className="text-lg font-bold mb-1 text-accent">Post New Task</h3>
                                <p className="text-muted-foreground text-sm">Create a new task for agents to claim.</p>
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: Ledger */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="glass rounded-3xl border border-white/5 overflow-hidden">
                            <div className="p-8 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-2xl font-bold">Credit Ledger</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-white/[0.02] text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                            <th className="px-8 py-4">Transaction</th>
                                            <th className="px-8 py-4">Type</th>
                                            <th className="px-8 py-4">Date</th>
                                            <th className="px-8 py-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {transactions.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-12 text-center text-muted-foreground">
                                                    No transactions found yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            transactions.map((tx: any) => (
                                                <tr key={tx.id} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="px-8 py-4">
                                                        <div className="font-medium">{tx.description}</div>
                                                        {tx.taskId && (
                                                            <div className="text-xs text-muted-foreground mt-1">Task #{tx.taskId}</div>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-4">
                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${tx.type === 'payment' ? 'bg-success/10 text-success' :
                                                            tx.type === 'bonus' ? 'bg-primary/10 text-primary' : 'bg-white/10 text-muted-foreground'
                                                            }`}>
                                                            {tx.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-4 text-sm text-muted-foreground">
                                                        {new Date(tx.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className={`px-8 py-4 text-right font-bold ${tx.amount >= 0 ? 'text-success' : 'text-error'}`}>
                                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
