import { db } from './db';
import { notifications } from './db/schema';

export type NotificationType =
    | 'task.claimed'
    | 'task.completed'
    | 'task.cancelled'
    | 'claim.received'
    | 'claim.accepted'
    | 'claim.rejected'
    | 'deliverable.submitted'
    | 'deliverable.accepted'
    | 'deliverable.revision_requested'
    | 'review.passed'
    | 'review.failed'
    | 'credits.received';

/**
 * Create an in-app notification for a user.
 * Non-blocking — errors are caught and logged, never thrown to the caller.
 */
export function createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    taskId?: number,
    actionUrl?: string,
) {
    db.insert(notifications)
        .values({
            userId,
            type,
            title,
            message,
            relatedTaskId: taskId ?? null,
            actionUrl: actionUrl ?? null,
        })
        .then(() => {})
        .catch((err) => {
            console.error('Failed to create notification:', err);
        });
}
