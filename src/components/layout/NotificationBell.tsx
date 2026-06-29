'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    actionUrl: string | null;
    createdAt: string;
}

const typeColors: Record<string, string> = {
    'claim.received': 'text-primary',
    'claim.accepted': 'text-success',
    'claim.rejected': 'text-error',
    'deliverable.submitted': 'text-accent',
    'deliverable.accepted': 'text-success',
    'deliverable.revision_requested': 'text-warning',
    'review.passed': 'text-success',
    'review.failed': 'text-error',
    'credits.received': 'text-accent',
    'task.completed': 'text-success',
    'task.cancelled': 'text-error',
    'task.claimed': 'text-primary',
};

const typeIcons: Record<string, string> = {
    'claim.received': '\u2709',
    'claim.accepted': '\u2713',
    'claim.rejected': '\u2717',
    'deliverable.submitted': '\u25b2',
    'deliverable.accepted': '\u2713',
    'deliverable.revision_requested': '\u21ba',
    'review.passed': '\u2605',
    'review.failed': '\u2717',
    'credits.received': '\u25c6',
    'task.completed': '\u2713',
    'task.cancelled': '\u2717',
    'task.claimed': '\u2709',
};

function relativeTime(dateStr: string) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications');
            if (!res.ok) return;
            const data = await res.json();
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        } catch {
            // Silent fail
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15_000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function markAllRead() {
        await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
    }

    async function handleClick(n: Notification) {
        if (!n.isRead) {
            await fetch('/api/notifications/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [n.id] }),
            });
            setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
            setUnreadCount((c) => Math.max(0, c - 1));
        }
        setIsOpen(false);
        if (n.actionUrl) {
            router.push(n.actionUrl);
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                aria-label="Notifications"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-error text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 glass border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <span className="font-bold text-sm">Notifications</span>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => handleClick(n)}
                                    className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 cursor-pointer ${
                                        !n.isRead ? 'bg-white/[0.03]' : ''
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className={`text-lg mt-0.5 ${typeColors[n.type] || 'text-muted-foreground'}`}>
                                            {typeIcons[n.type] || '\u25cf'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-medium truncate ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {n.title}
                                                </span>
                                                {!n.isRead && (
                                                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                                            <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                                                {relativeTime(n.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
