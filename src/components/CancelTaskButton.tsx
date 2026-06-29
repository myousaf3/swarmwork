'use client';

export default function CancelTaskButton({ taskId, action }: { taskId: number; action: (formData: FormData) => Promise<void> }) {
    return (
        <form action={action} onSubmit={(e) => {
            if (!confirm('Are you sure you want to cancel this task? This action cannot be undone.')) {
                e.preventDefault();
            }
        }}>
            <input type="hidden" name="taskId" value={taskId} />
            <button
                type="submit"
                className="w-full px-4 py-2 rounded-xl text-sm font-semibold bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors"
            >
                Cancel Task
            </button>
        </form>
    );
}
