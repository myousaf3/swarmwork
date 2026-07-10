import Header from '@/components/layout/Header';
import { db } from '@/lib/db';
import { tasks, categories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import Link from 'next/link';
import EditTaskForm from './EditTaskForm';

export const dynamic = 'force-dynamic';

async function updateTaskAction(formData: FormData) {
    'use server';
    const taskId = parseInt(formData.get('taskId') as string);
    const { user } = await (await import('@/lib/session')).requireSession();

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task || task.posterId !== user.id || task.status !== 'open') return;

    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const requirements = formData.get('requirements') as string;
    const budgetCredits = parseInt(formData.get('budget_credits') as string);
    const categoryId = formData.get('category_id') as string;
    const deadline = formData.get('deadline') as string;
    const maxRevisions = parseInt(formData.get('max_revisions') as string) || 2;

    // Auto-review fields
    const autoReviewEnabled = formData.get('auto_review_enabled') === 'true';
    const posterLlmProvider = formData.get('poster_llm_provider') as string | null;
    const posterLlmKey = formData.get('poster_llm_key') as string | null;
    const posterMaxReviews = parseInt(formData.get('poster_max_reviews') as string) || null;

    if (!title || !description || !budgetCredits || budgetCredits < 10) {
        throw new Error('Title, description, and budget (min 10) are required.');
    }

    // Encrypt poster LLM key if a new one was provided
    let posterLlmKeyEncrypted: string | null | undefined = undefined; // undefined = don't change
    if (autoReviewEnabled && posterLlmKey) {
        const { encrypt } = await import('@/lib/encryption');
        posterLlmKeyEncrypted = await encrypt(posterLlmKey);
    } else if (!autoReviewEnabled) {
        posterLlmKeyEncrypted = null; // clear key if auto-review disabled
    }

    const updateValues: Record<string, any> = {
        title,
        description,
        requirements: requirements || null,
        budgetCredits,
        categoryId: categoryId ? parseInt(categoryId) : null,
        deadline: deadline ? new Date(deadline) : null,
        maxRevisions,
        autoReviewEnabled,
        posterLlmProvider: autoReviewEnabled ? posterLlmProvider : null,
        posterMaxReviews: autoReviewEnabled ? posterMaxReviews : null,
        updatedAt: new Date(),
    };
    if (posterLlmKeyEncrypted !== undefined) {
        updateValues.posterLlmKeyEncrypted = posterLlmKeyEncrypted;
    }

    await db.update(tasks).set(updateValues).where(eq(tasks.id, taskId));

    redirect(`/tasks/${taskId}`);
}

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
    const { user } = await requireSession();
    const { id } = await params;
    const taskId = parseInt(id);

    const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
    });

    if (!task) notFound();
    if (task.posterId !== user.id) redirect(`/tasks/${taskId}`);
    if (task.status !== 'open') redirect(`/tasks/${taskId}`);

    const allCategories = await db.select().from(categories).orderBy(categories.sortOrder);

    const taskData = {
        id: task.id,
        title: task.title,
        description: task.description,
        requirements: task.requirements,
        budgetCredits: task.budgetCredits,
        categoryId: task.categoryId,
        deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : null,
        maxRevisions: task.maxRevisions,
        autoReviewEnabled: task.autoReviewEnabled,
        posterLlmProvider: task.posterLlmProvider,
        posterMaxReviews: task.posterMaxReviews,
        hasLlmKey: !!task.posterLlmKeyEncrypted,
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-grow pt-28 pb-20 container mx-auto px-6 max-w-3xl">
                <Link href={`/tasks/${taskId}`} className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 transition-colors">
                    <span className="mr-2">&larr;</span> Back to Task
                </Link>

                <div className="mb-12">
                    <h1 className="text-4xl font-bold mb-2">Edit Task</h1>
                    <p className="text-muted-foreground text-lg">Update your task details. Only open tasks can be edited.</p>
                </div>

                <EditTaskForm task={taskData} categories={allCategories} action={updateTaskAction} />
            </main>
        </div>
    );
}
