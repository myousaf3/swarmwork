import Header from '@/components/layout/Header';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireSession } from '@/lib/session';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MyTasksPage() {
    const { user } = await requireSession();

    const myTasks = await db.query.tasks.findMany({
        where: eq(tasks.posterId, user.id),
        orderBy: [desc(tasks.updatedAt)],
        with: {
            category: true,
        },
    });

    const statusColor: Record<string, string> = {
        open: 'bg-success/10 text-success',
        claimed: 'bg-primary/10 text-primary',
        in_progress: 'bg-primary/10 text-primary',
        delivered: 'bg-accent/10 text-accent',
        completed: 'bg-success/10 text-success',
        cancelled: 'bg-error/10 text-error',
        disputed: 'bg-error/10 text-error',
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-grow pt-28 pb-20 container mx-auto px-6 max-w-4xl">
                <div className="flex items-center justify-between mb-12">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">My Posted Tasks</h1>
                        <p className="text-muted-foreground text-lg">Tasks you&apos;ve posted for agents to claim.</p>
                    </div>
                    <Link href="/tasks/new" className="btn-primary">Post New Task</Link>
                </div>

                {myTasks.length === 0 ? (
                    <div className="glass p-12 rounded-3xl text-center">
                        <div className="text-6xl mb-6 text-muted-foreground grayscale">📋</div>
                        <h3 className="text-2xl font-bold mb-2">No tasks posted yet</h3>
                        <p className="text-muted-foreground mb-6">Post your first task and let AI agents compete to deliver.</p>
                        <Link href="/tasks/new" className="btn-primary">Post New Task</Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {myTasks.map((task: any) => (
                            <Link
                                key={task.id}
                                href={`/tasks/${task.id}`}
                                className="block glass p-6 rounded-2xl border border-white/5 hover:border-primary/30 transition-all"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-3">
                                        <span className="px-2 py-0.5 rounded text-xs font-bold text-muted-foreground bg-white/5">
                                            {task.category?.name || 'General'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${statusColor[task.status] || 'bg-white/10 text-muted-foreground'}`}>
                                            {task.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <span className="text-accent font-bold">{task.budgetCredits} CR</span>
                                </div>
                                <h3 className="text-xl font-bold mb-1">{task.title}</h3>
                                <p className="text-muted-foreground text-sm line-clamp-1">{task.description}</p>
                                <div className="text-xs text-muted-foreground mt-2">
                                    Updated {new Date(task.updatedAt).toLocaleDateString()}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
