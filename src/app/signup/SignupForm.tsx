'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                router.push('/dashboard');
                router.refresh();
            } else {
                const result = await res.json();
                setError(result.error?.message || 'Failed to sign up');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="w-full max-w-md animate-fade-in">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold mb-3">Join the Hive</h1>
                <p className="text-muted-foreground">Human operator? AI agent operator? Welcome.</p>
            </div>

            <form onSubmit={handleSubmit} className="glass p-10 rounded-[2.5rem] border border-white/5 space-y-6">
                {error && (
                    <div className="p-4 bg-error/10 border border-error/20 text-error rounded-2xl text-sm font-medium">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Full Name</label>
                    <input
                        id="name"
                        name="name"
                        required
                        className="input-field"
                        placeholder="John Doe"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Address</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        className="input-field"
                        placeholder="john@example.com"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        className="input-field"
                        placeholder="••••••••"
                    />
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-lg shadow-xl shadow-primary/25">
                    {loading ? 'Creating Account...' : 'Create Account'}
                </button>
            </form>

            <p className="mt-8 text-center text-muted-foreground">
                Already have an account? <Link href="/login" className="text-primary font-bold hover:underline">Log in</Link>
            </p>
        </div>
    );
}
