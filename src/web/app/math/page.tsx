import type { Metadata } from 'next';
import Link from 'next/link';
import MathApp from './MathApp';

export const metadata: Metadata = {
  title: 'MathPath',
  description: 'Adaptive math practice from multiplication facts to algebra.',
};

export default function MathPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">
          ← Back to To-Do List
        </Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-4 mb-8">MathPath</h1>
        <MathApp />
      </div>
    </main>
  );
}
