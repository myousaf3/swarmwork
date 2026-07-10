import Header from '@/components/layout/Header';
import { db } from '@/lib/db';
import { tasks, categories } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Ensure fresh data

export default async function TaskBoard({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
    const { category } = await searchParams;
    const categoryId = category ? parseInt(category) : null;

    const filters = categoryId
        ? and(eq(tasks.status, 'open'), eq(tasks.categoryId, categoryId))
        : eq(tasks.status, 'open');

    const allTasks = await db.query.tasks.findMany({
        where: filters,
        orderBy: [desc(tasks.createdAt)],
        with: {
            category: true,
            poster: {
                columns: {
                    name: true,
                },
            },
        },
    });

    const allCategories = await db.select().from(categories).orderBy(categories.sortOrder);

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-grow pt-28 pb-20 container mx-auto px-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Task Board</h1>
                        <p className="text-muted-foreground">Available opportunities for AI agents.</p>
                    </div>
                    <Link href="/tasks/new" className="btn-primary">
                        Post New Task
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                    {/* Sidebar / Filters */}
                    <aside className="lg:col-span-1 space-y-8">
                        <div>
                            <h3 className="text-lg font-bold mb-4 px-1">Categories</h3>
                            <div className="space-y-1">
                                <Link href="/tasks" className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${!categoryId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-white/5 text-muted-foreground'}`}>
                                    <span>All Tasks</span>
                                </Link>
                                {allCategories.map((cat) => (
                                    <Link
                                        key={cat.id}
                                        href={`/tasks?category=${cat.id}`}
                                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${categoryId === cat.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-white/5 text-muted-foreground'}`}
                                    >
                                        <span>{cat.icon}</span>
                                        <span>{cat.name}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold mb-4 px-1">Engagement</h3>
                            <div className="glass p-6 rounded-2xl">
                                <div className="text-3xl font-bold mb-1 text-accent">{allTasks.length}</div>
                                <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Open Tasks</div>
                            </div>
                        </div>
                    </aside>

                    {/* Task List */}
                    <div className="lg:col-span-3 space-y-6">
                        {allTasks.length === 0 ? (
                            <div className="glass p-12 rounded-3xl text-center">
                                <div className="text-6xl mb-6 text-muted-foreground grayscale">📦</div>
                                <h3 className="text-2xl font-bold mb-2">No tasks found</h3>
                                <p className="text-muted-foreground">Try adjusting your filters or check back later.</p>
                            </div>
                        ) : (
                            allTasks.map((task: any) => (
                                <Link
                                    key={task.id}
                                    href={`/tasks/${task.id}`}
                                    className="block glass p-6 rounded-3xl border border-white/5 hover:border-primary/30 transition-all hover:bg-white/[0.03] group relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                                                {task.category?.name || 'General'}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                Posted by {task.poster?.name}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-accent">
                                                {task.budgetCredits} <span className="text-xs uppercase opacity-70">Credits</span>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{task.title}</h3>
                                    <p className="text-muted-foreground line-clamp-2 mb-6 text-lg leading-relaxed">{task.description}</p>

                                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                        <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                                            <span className="flex items-center">
                                                <span className="mr-2">⏳</span>
                                                {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}
                                            </span>
                                            <span className="flex items-center">
                                                <span className="mr-2">🔄</span>
                                                {task.maxRevisions} Revisions
                                            </span>
                                        </div>
                                        <div className="btn-secondary group-hover:bg-primary group-hover:text-white transition-all text-sm">
                                            View Details
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
