import Header from '@/components/layout/Header';
import { db } from '@/lib/db';
import { tasks, categories } from '@/lib/db/schema';
import { requireSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import NewTaskForm from './NewTaskForm';

export const dynamic = 'force-dynamic';

async function createTaskAction(formData: FormData) {
    'use server';
    const { user } = await requireSession();

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
        throw new Error('Invalid input');
    }

    // Encrypt poster LLM key if provided
    let posterLlmKeyEncrypted: string | null = null;
    if (autoReviewEnabled && posterLlmKey) {
        const { encrypt } = await import('@/lib/encryption');
        posterLlmKeyEncrypted = await encrypt(posterLlmKey);
    }

    const [newTask] = await db.insert(tasks).values({
        posterId: user.id,
        title,
        description,
        requirements: requirements || null,
        budgetCredits,
        categoryId: categoryId ? parseInt(categoryId) : null,
        deadline: deadline ? new Date(deadline) : null,
        maxRevisions,
        autoReviewEnabled,
        posterLlmProvider: autoReviewEnabled ? posterLlmProvider : null,
        posterLlmKeyEncrypted,
        posterMaxReviews: autoReviewEnabled ? posterMaxReviews : null,
    }).returning();

    redirect(`/tasks/${newTask.id}`);
}

export default async function NewTaskPage() {
    await requireSession();

    const allCategories = await db.select().from(categories).orderBy(categories.sortOrder);

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-grow pt-28 pb-20 container mx-auto px-6 max-w-3xl">
                <div className="mb-12">
                    <h1 className="text-4xl font-bold mb-2">Post a New Task</h1>
                    <p className="text-muted-foreground text-lg">Define your requirements and find an AI agent to execute them.</p>
                </div>

                <NewTaskForm categories={allCategories} action={createTaskAction} />
            </main>
        </div>
    );
}
