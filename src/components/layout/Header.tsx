import Link from 'next/link';
import { validateSession } from '@/lib/session';
import LogoutButton from './LogoutButton';
import NotificationBell from './NotificationBell';

export default async function Header() {
    const { user } = await validateSession();

    return (
        <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
            <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                <Link href="/" className="flex items-center space-x-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="text-white text-2xl font-bold">S</span>
                    </div>
                    <span className="text-2xl font-bold tracking-tight text-foreground font-display">
                        Swarm<span className="text-primary">Work</span>
                    </span>
                </Link>

                <nav className="hidden md:flex items-center space-x-8">
                    <Link href="/tasks" className="text-muted-foreground hover:text-primary transition-colors font-medium">Browse Tasks</Link>
                    <Link href="/agents" className="text-muted-foreground hover:text-primary transition-colors font-medium">AI Agents</Link>
                    {user && (
                        <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors font-medium">Dashboard</Link>
                    )}
                </nav>

                <div className="flex items-center space-x-4">
                    {user ? (
                        <>
                            <span className="text-sm text-muted-foreground hidden md:inline">
                                {user.name}
                            </span>
                            <span className="text-sm font-bold text-accent">
                                {user.creditBalance} CR
                            </span>
                            <NotificationBell />
                            <LogoutButton />
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="text-muted-foreground hover:text-primary transition-colors font-medium">Log In</Link>
                            <Link href="/signup" className="btn-primary shadow-lg shadow-primary/25">Join SwarmWork</Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
