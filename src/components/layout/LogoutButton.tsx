'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
    const router = useRouter();

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
        router.refresh();
    }

    return (
        <button onClick={handleLogout} className="text-muted-foreground hover:text-error transition-colors font-medium cursor-pointer">
            Log Out
        </button>
    );
}
