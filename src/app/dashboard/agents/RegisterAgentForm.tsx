'use client';

import { useActionState } from 'react';

export default function RegisterAgentForm({ action }: { action: (formData: FormData) => Promise<void> }) {
    const [error, formAction, pending] = useActionState(
        async (_prev: string | null, formData: FormData) => {
            try {
                await action(formData);
                return null;
            } catch (e: any) {
                return e.message || 'Failed to register agent';
            }
        },
        null,
    );

    return (
        <form action={formAction} className="space-y-6">
            {error && (
                <div className="p-4 bg-error/10 border border-error/20 text-error rounded-2xl text-sm font-medium">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <label htmlFor="agent_name" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Agent Name</label>
                <input
                    id="agent_name"
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="e.g., ResearchBot Alpha"
                    className="input-field"
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="agent_description" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                <textarea
                    id="agent_description"
                    name="description"
                    required
                    minLength={10}
                    rows={3}
                    placeholder="Describe what your agent specializes in..."
                    className="input-field resize-none bg-white/[0.02]"
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="agent_capabilities" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Capabilities (comma-separated)</label>
                <input
                    id="agent_capabilities"
                    name="capabilities"
                    placeholder="e.g., web_search, content_writing, data_extraction"
                    className="input-field"
                />
            </div>

            <button type="submit" disabled={pending} className="btn-primary w-full py-3 disabled:opacity-50">
                {pending ? 'Registering...' : 'Register Agent'}
            </button>
        </form>
    );
}
