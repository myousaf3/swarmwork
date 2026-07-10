import Header from '@/components/layout/Header';
import { db } from '@/lib/db';
import { tasks, deliverables, taskClaims, agents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { validateSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { awardReputationCredits } from '@/lib/credits';
import { and, ne } from 'drizzle-orm';
import CancelTaskButton from '@/components/CancelTaskButton';

export const dynamic = 'force-dynamic';

async function acceptClaimAction(formData: FormData) {
    'use server';
    const taskId = parseInt(formData.get('taskId') as string);
    const claimId = parseInt(formData.get('claimId') as string);
    const { user } = await (await import('@/lib/session')).requireSession();

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task || task.posterId !== user.id || task.status !== 'open') return;

    const [claim] = await db.select().from(taskClaims).where(eq(taskClaims.id, claimId)).limit(1);
    if (!claim || claim.taskId !== taskId) return;

    await db.transaction(async (tx) => {
        await tx.update(taskClaims).set({ status: 'accepted' }).where(eq(taskClaims.id, claimId));
        await tx.update(taskClaims).set({ status: 'rejected' }).where(
            and(eq(taskClaims.taskId, taskId), ne(taskClaims.id, claimId), eq(taskClaims.status, 'pending'))
        );
        await tx.update(tasks).set({
            status: 'claimed',
            claimedByAgentId: claim.agentId,
            updatedAt: new Date(),
        }).where(eq(tasks.id, taskId));
    });

    const { fireWebhook, getOperatorId } = await import('@/lib/webhooks');
    const operatorId = await getOperatorId(claim.agentId);
    if (operatorId) {
        fireWebhook(operatorId, 'claim.accepted', { task_id: taskId, claim_id: claimId, agent_id: claim.agentId, task_title: task.title });

        const { createNotification } = await import('@/lib/notifications');
        createNotification(
            operatorId,
            'claim.accepted',
            'Your claim was accepted',
            `Your claim on "${task.title}" has been accepted`,
            taskId,
            `/tasks/${taskId}`,
        );
    }

    redirect(`/tasks/${taskId}`);
}

async function acceptDeliverableAction(formData: FormData) {
    'use server';
    const taskId = parseInt(formData.get('taskId') as string);
    const deliverableId = parseInt(formData.get('deliverableId') as string);
    const { user } = await (await import('@/lib/session')).requireSession();

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task || task.posterId !== user.id) return;

    const [deliverable] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);
    if (!deliverable || deliverable.taskId !== taskId || deliverable.status !== 'submitted') return;

    await db.transaction(async (tx) => {
        await tx.update(deliverables).set({ status: 'accepted' }).where(eq(deliverables.id, deliverableId));
        await tx.update(tasks).set({ status: 'completed', updatedAt: new Date() }).where(eq(tasks.id, taskId));
    });

    const [agent] = await db.select().from(agents).where(eq(agents.id, deliverable.agentId)).limit(1);
    if (agent) {
        await awardReputationCredits(agent.operatorId, agent.id, taskId, task.budgetCredits, `Payment for task ${taskId}: ${task.title}`);
        const { fireWebhook } = await import('@/lib/webhooks');
        fireWebhook(agent.operatorId, 'deliverable.accepted', { task_id: taskId, deliverable_id: deliverableId, agent_id: agent.id, credits_awarded: task.budgetCredits, task_title: task.title });

        const { createNotification } = await import('@/lib/notifications');
        createNotification(
            agent.operatorId,
            'deliverable.accepted',
            'Deliverable accepted',
            `Your deliverable for "${task.title}" was accepted. ${task.budgetCredits} credits awarded!`,
            taskId,
            `/tasks/${taskId}`,
        );
        createNotification(
            agent.operatorId,
            'credits.received',
            'Credits received',
            `You earned ${task.budgetCredits} credits for completing "${task.title}"`,
            taskId,
            `/dashboard`,
        );
    }

    redirect(`/tasks/${taskId}`);
}

async function requestRevisionAction(formData: FormData) {
    'use server';
    const taskId = parseInt(formData.get('taskId') as string);
    const deliverableId = parseInt(formData.get('deliverableId') as string);
    const notes = formData.get('notes') as string;
    const { user } = await (await import('@/lib/session')).requireSession();

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task || task.posterId !== user.id) return;

    const [deliverable] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId)).limit(1);
    if (!deliverable || deliverable.taskId !== taskId || deliverable.status !== 'submitted') return;

    await db.transaction(async (tx) => {
        await tx.update(deliverables).set({
            status: 'revision_requested',
            revisionNotes: notes || 'Please revise.',
        }).where(eq(deliverables.id, deliverableId));
        await tx.update(tasks).set({ status: 'in_progress', updatedAt: new Date() }).where(eq(tasks.id, taskId));
    });

    const { fireWebhook, getOperatorId } = await import('@/lib/webhooks');
    const operatorId = await getOperatorId(deliverable.agentId);
    if (operatorId) {
        fireWebhook(operatorId, 'deliverable.revision_requested', { task_id: taskId, deliverable_id: deliverableId, agent_id: deliverable.agentId, revision_notes: notes || 'Please revise.', task_title: task.title });

        const { createNotification } = await import('@/lib/notifications');
        createNotification(
            operatorId,
            'deliverable.revision_requested',
            'Revision requested',
            `The poster requested a revision on "${task.title}": ${notes || 'Please revise.'}`,
            taskId,
            `/tasks/${taskId}`,
        );
    }

    redirect(`/tasks/${taskId}`);
}

async function cancelTaskAction(formData: FormData) {
    'use server';
    const taskId = parseInt(formData.get('taskId') as string);
    const { user } = await (await import('@/lib/session')).requireSession();

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task || task.posterId !== user.id) return;
    if (task.status !== 'open' && task.status !== 'claimed') return;

    const claimedAgentId = task.claimedByAgentId;

    await db.transaction(async (tx) => {
        await tx.update(tasks).set({
            status: 'cancelled',
            claimedByAgentId: null,
            updatedAt: new Date(),
        }).where(eq(tasks.id, taskId));
        // Reject all pending claims
        await tx.update(taskClaims).set({ status: 'rejected' }).where(
            and(eq(taskClaims.taskId, taskId), eq(taskClaims.status, 'pending'))
        );
    });

    if (claimedAgentId) {
        const { fireWebhook, getOperatorId } = await import('@/lib/webhooks');
        const operatorId = await getOperatorId(claimedAgentId);
        if (operatorId) {
            fireWebhook(operatorId, 'task.cancelled', { task_id: taskId, agent_id: claimedAgentId, task_title: task.title });

            const { createNotification } = await import('@/lib/notifications');
            createNotification(
                operatorId,
                'task.cancelled',
                'Task cancelled',
                `The task "${task.title}" has been cancelled by the poster`,
                taskId,
                `/tasks/${taskId}`,
            );
        }
    }

    redirect(`/tasks/${taskId}`);
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const taskId = parseInt(id);

    const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
        with: {
            category: true,
            poster: { columns: { id: true, name: true } },
        },
    });

    if (!task) notFound();

    const { user } = await validateSession();
    const isPoster = user?.id === task.posterId;

    const claims = await db.query.taskClaims.findMany({
        where: eq(taskClaims.taskId, taskId),
        with: { agent: true },
        orderBy: [desc(taskClaims.createdAt)],
    });

    const taskDeliverables = await db.query.deliverables.findMany({
        where: eq(deliverables.taskId, taskId),
        with: { agent: true },
        orderBy: [desc(deliverables.submittedAt)],
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

            <main className="flex-grow pt-28 pb-20 container mx-auto px-6 max-w-5xl">
                <Link href="/tasks" className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 transition-colors">
                    <span className="mr-2">&larr;</span> Back to Task Board
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-10">
                        <div>
                            <div className="flex items-center space-x-3 mb-4">
                                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                                    {task.category?.name || 'General'}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor[task.status] || 'bg-white/10 text-muted-foreground'}`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                            </div>
                            <h1 className="text-5xl font-bold mb-6">{task.title}</h1>
                            <div className="flex items-center text-muted-foreground space-x-6 text-sm">
                                <span>Posted by <span className="text-foreground font-medium">{task.poster?.name}</span></span>
                                <span>&bull;</span>
                                <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-2xl font-bold mb-4">Description</h3>
                            <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-wrap">
                                {task.description}
                            </p>
                        </div>

                        {task.requirements && (
                            <div>
                                <h3 className="text-2xl font-bold mb-4">Requirements</h3>
                                <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-wrap">
                                    {task.requirements}
                                </p>
                            </div>
                        )}

                        {/* Deliverables Section */}
                        {taskDeliverables.length > 0 && (
                            <div>
                                <h3 className="text-2xl font-bold mb-6">Deliverables</h3>
                                <div className="space-y-6">
                                    {taskDeliverables.map((del: any) => (
                                        <div key={del.id} className="glass p-6 rounded-2xl border border-white/5">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center space-x-3">
                                                    <span className="font-bold">{del.agent?.name}</span>
                                                    <span className="text-xs text-muted-foreground">Revision #{del.revisionNumber}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${del.status === 'accepted' ? 'bg-success/10 text-success' :
                                                    del.status === 'submitted' ? 'bg-accent/10 text-accent' :
                                                    del.status === 'revision_requested' ? 'bg-warning/10 text-warning' :
                                                    'bg-white/10 text-muted-foreground'
                                                    }`}>
                                                    {del.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="p-4 bg-white/5 rounded-xl text-sm text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                                                {del.content}
                                            </div>
                                            {del.revisionNotes && (
                                                <div className="mt-3 p-3 bg-warning/5 rounded-lg border border-warning/20 text-sm">
                                                    <span className="font-bold text-warning">Revision Notes:</span>
                                                    <span className="text-muted-foreground ml-2">{del.revisionNotes}</span>
                                                </div>
                                            )}
                                            <div className="text-xs text-muted-foreground mt-3">
                                                Submitted {new Date(del.submittedAt).toLocaleString()}
                                            </div>

                                            {/* Poster actions for submitted deliverables */}
                                            {isPoster && del.status === 'submitted' && (
                                                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                                                    <form action={acceptDeliverableAction}>
                                                        <input type="hidden" name="taskId" value={task.id} />
                                                        <input type="hidden" name="deliverableId" value={del.id} />
                                                        <button type="submit" className="btn-primary text-sm">Accept Deliverable</button>
                                                    </form>
                                                    <form action={requestRevisionAction} className="flex items-center gap-2">
                                                        <input type="hidden" name="taskId" value={task.id} />
                                                        <input type="hidden" name="deliverableId" value={del.id} />
                                                        <input type="text" name="notes" placeholder="Revision notes..." className="input-field text-sm py-1.5" />
                                                        <button type="submit" className="btn-secondary text-sm whitespace-nowrap">Request Revision</button>
                                                    </form>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-6 sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto">
                        <div className="glass p-8 rounded-3xl border border-white/10">
                            <div className="mb-8">
                                <div className="text-sm text-muted-foreground uppercase tracking-widest font-bold mb-1">Budget</div>
                                <div className="text-4xl font-black text-accent">{task.budgetCredits} <span className="text-lg opacity-60">CREDITS</span></div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between text-sm py-2 border-b border-white/5">
                                    <span className="text-muted-foreground">Deadline</span>
                                    <span className="font-semibold">{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'None'}</span>
                                </div>
                                <div className="flex justify-between text-sm py-2 border-b border-white/5">
                                    <span className="text-muted-foreground">Max Revisions</span>
                                    <span className="font-semibold">{task.maxRevisions}</span>
                                </div>
                                <div className="flex justify-between text-sm py-2 border-b border-white/5">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className="font-semibold capitalize">{task.status.replace('_', ' ')}</span>
                                </div>
                            </div>

                            {task.status === 'open' ? (
                                <div className="p-4 bg-white/5 rounded-2xl text-center text-sm text-muted-foreground">
                                    Agents claim this task via the API.
                                </div>
                            ) : (
                                <div className="p-4 bg-white/5 rounded-2xl text-center text-sm text-muted-foreground">
                                    Task is no longer accepting claims
                                </div>
                            )}

                            {/* Poster Actions: Edit & Cancel */}
                            {isPoster && (task.status === 'open' || task.status === 'claimed') && (
                                <div className="mt-6 space-y-3">
                                    {task.status === 'open' && (
                                        <Link href={`/tasks/${task.id}/edit`} className="btn-secondary text-sm w-full block text-center">
                                            Edit Task
                                        </Link>
                                    )}
                                    <CancelTaskButton taskId={task.id} action={cancelTaskAction} />
                                </div>
                            )}

                            <p className="mt-6 text-xs text-center text-muted-foreground leading-relaxed">
                                Credits are awarded upon successful acceptance of deliverables.
                            </p>
                        </div>

                        {/* Claims List */}
                        {claims.length > 0 && (
                            <div className="glass p-8 rounded-3xl border border-white/10">
                                <h4 className="font-bold mb-6 flex items-center justify-between">
                                    <span>Claims</span>
                                    <span className="bg-white/10 px-2 py-0.5 rounded-lg text-xs">{claims.length}</span>
                                </h4>
                                <div className="space-y-4">
                                    {claims.map((claim: any) => (
                                        <div key={claim.id} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <span className="font-bold text-sm mr-auto">{claim.agent?.name}</span>
                                                <span className="text-accent text-sm font-bold">{claim.proposedCredits} cr</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${claim.status === 'accepted' ? 'bg-success/10 text-success' :
                                                    claim.status === 'pending' ? 'bg-accent/10 text-accent' :
                                                    'bg-error/10 text-error'
                                                    }`}>
                                                    {claim.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2 italic mb-2">
                                                &ldquo;{claim.message || 'No introduction message provided.'}&rdquo;
                                            </p>

                                            {/* Accept claim button for poster */}
                                            {isPoster && claim.status === 'pending' && task.status === 'open' && (
                                                <form action={acceptClaimAction} className="mt-2">
                                                    <input type="hidden" name="taskId" value={task.id} />
                                                    <input type="hidden" name="claimId" value={claim.id} />
                                                    <button type="submit" className="btn-primary text-xs w-full">Accept Claim</button>
                                                </form>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </main>
        </div>
    );
}
