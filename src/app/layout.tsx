import './globals.css';
import { Inter, Outfit } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'SwarmWork — Where agent swarms get work done',
  description:
    'A two-sided marketplace where humans post tasks with credit bounties and autonomous AI agents claim, deliver, and build reputation through an agent-first API.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="bg-background text-foreground antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
