'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';

type Category = { id: number; name: string; slug: string; icon: string | null };

type TaskData = {
    id: number;
    title: string;
    description: string;
    requirements: string | null;
    budgetCredits: number;
    categoryId: number | null;
    deadline: string | null;
    maxRevisions: number;
    autoReviewEnabled: boolean;
    posterLlmProvider: string | null;
    posterMaxReviews: number | null;
    hasLlmKey: boolean;
};

export default function EditTaskForm({
    task,
    categories,
    action,
}: {
    task: TaskData;
    categories: Category[];
    action: (formData: FormData) => Promise<void>;
}) {
    const [autoReview, setAutoReview] = useState(task.autoReviewEnabled);
    const [error, formAction, pending] = useActionState(
        async (_prev: string | null, formData: FormData) => {
            try {
                await action(formData);
                return null;
            } catch (e: any) {
                return e.message || 'Failed to update task';
            }
        },
        null,
    );

    return (
        <form action={formAction} className="space-y-8 animate-fade-in">
            <input type="hidden" name="taskId" value={task.id} />

            {error && (
                <div className="p-4 bg-error/10 border border-error/20 text-error rounded-2xl text-sm font-medium">
                    {error}
                </div>
            )}

            <div className="space-y-6 glass p-8 rounded-3xl border border-white/5">
                <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Task Title</label>
                    <input
                        id="title"
                        name="title"
                        required
                        minLength={5}
                        maxLength={200}
                        defaultValue={task.title}
                        className="input-field text-lg"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                    <textarea
                        id="description"
                        name="description"
                        required
                        minLength={20}
                        rows={6}
                        defaultValue={task.description}
                        className="input-field resize-none bg-white/[0.02]"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="requirements" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Requirements (Optional)</label>
                    <textarea
                        id="requirements"
                        name="requirements"
                        rows={3}
                        defaultValue={task.requirements || ''}
                        className="input-field resize-none bg-white/[0.02]"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="category_id" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Category</label>
                    <select id="category_id" name="category_id" defaultValue={task.categoryId?.toString() || ''} className="input-field bg-white/[0.02]">
                        <option value="">Select a category...</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label htmlFor="budget_credits" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Budget (Credits)</label>
                        <input
                            id="budget_credits"
                            name="budget_credits"
                            type="number"
                            required
                            min={10}
                            defaultValue={task.budgetCredits}
                            className="input-field"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="deadline" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Deadline (Optional)</label>
                        <input
                            id="deadline"
                            name="deadline"
                            type="datetime-local"
                            defaultValue={task.deadline || ''}
                            className="input-field"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="max_revisions" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Max Revisions</label>
                    <select id="max_revisions" name="max_revisions" defaultValue={task.maxRevisions.toString()} className="input-field bg-white/[0.02]">
                        <option value="0">None</option>
                        <option value="1">1 Revision</option>
                        <option value="2">2 Revisions (Standard)</option>
                        <option value="3">3 Revisions</option>
                        <option value="5">5 Revisions</option>
                    </select>
                </div>
            </div>

            <div className="space-y-6 glass p-8 rounded-3xl border border-white/5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">AI Auto-Review</h3>
                        <p className="text-sm text-muted-foreground">Automatically evaluate deliverables against your requirements using an LLM.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            name="auto_review_enabled"
                            value="true"
                            checked={autoReview}
                            onChange={(e) => setAutoReview(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>

                {autoReview && (
                    <div className="space-y-4 pt-2 border-t border-white/5">
                        <div className="space-y-2">
                            <label htmlFor="poster_llm_provider" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">LLM Provider</label>
                            <select id="poster_llm_provider" name="poster_llm_provider" defaultValue={task.posterLlmProvider || 'anthropic'} className="input-field bg-white/[0.02]">
                                <option value="anthropic">Anthropic</option>
                                <option value="openai">OpenAI</option>
                                <option value="openrouter">OpenRouter</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="poster_llm_key" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">LLM API Key</label>
                            <input
                                id="poster_llm_key"
                                name="poster_llm_key"
                                type="password"
                                placeholder={task.hasLlmKey ? '••••••••  (leave blank to keep current)' : 'sk-...'}
                                className="input-field"
                            />
                            <p className="text-xs text-muted-foreground">Your key is encrypted at rest and only used by the reviewer agent.</p>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="poster_max_reviews" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Max Auto-Reviews</label>
                            <input
                                id="poster_max_reviews"
                                name="poster_max_reviews"
                                type="number"
                                min={1}
                                defaultValue={task.posterMaxReviews || 5}
                                className="input-field"
                            />
                            <p className="text-xs text-muted-foreground">Limit how many times the AI reviewer can evaluate submissions for this task.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end space-x-6">
                <Link href={`/tasks/${task.id}`} className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                    Cancel
                </Link>
                <button type="submit" disabled={pending} className="btn-primary px-12 py-4 shadow-xl shadow-primary/25 disabled:opacity-50">
                    {pending ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
    );
}
