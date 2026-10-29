import type { Metadata } from 'next';
import Link from 'next/link';
import { getCalendarTasks } from '../actions';
import Calendar from './Calendar';

export const metadata: Metadata = {
  title: 'Calendar',
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const yearParam = Number(single(params.year));
  const monthParam = Number(single(params.month));
  const year =
    Number.isInteger(yearParam) && yearParam >= 1 && yearParam <= 9999 ? yearParam : now.getFullYear();
  const month =
    Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1;

  const tasks = await getCalendarTasks(year, month);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">
          ← Back to To-Do List
        </Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-4 mb-8">
          Calendar
        </h1>
        <Calendar key={`${year}-${month}`} year={year} month={month} today={today} tasks={tasks} />
      </div>
    </main>
  );
}
