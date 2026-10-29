import type { Metadata } from 'next';
import Link from 'next/link';
import Calculator from './Calculator';

export const metadata: Metadata = {
  title: 'Calculator',
};

export default function CalculatorPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-16 px-4">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">
          ← Back to To-Do List
        </Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-4 mb-8">
          Calculator
        </h1>
        <Calculator />
      </div>
    </main>
  );
}
