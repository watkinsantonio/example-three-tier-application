'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { createTask, toggleTask, updateTaskDueDate, type Task } from '../actions';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toISODate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function monthHref(year: number, month: number) {
  // month is 1-12; normalise overflow into the adjacent year
  const date = new Date(Date.UTC(year, month - 1, 1));
  return `/calendar?year=${date.getUTCFullYear()}&month=${date.getUTCMonth() + 1}`;
}

/** Build the month grid as weeks of 7 cells; null cells pad the first/last week. */
function buildWeeks(year: number, month: number): (number | null)[][] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

type CalendarProps = {
  year: number;
  /** 1-12 */
  month: number;
  /** Today's date as 'YYYY-MM-DD' */
  today: string;
  /** Tasks due within this month */
  tasks: Task[];
};

export default function Calendar({ year, month, today, tasks }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tasksByDate = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.due_date) continue;
    const list = tasksByDate.get(task.due_date) ?? [];
    list.push(task);
    tasksByDate.set(task.due_date, list);
  }

  const weeks = buildWeeks(year, month);
  const selectedTasks = selectedDate ? tasksByDate.get(selectedDate) ?? [] : [];

  function onToggle(task: Task) {
    startTransition(() => toggleTask(task.id, !task.completed));
  }

  function onReschedule(task: Task, dueDate: string | null) {
    startTransition(() => updateTaskDueDate(task.id, dueDate));
  }

  return (
    <div className={isPending ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={monthHref(year, month - 1)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Previous month"
        >
          ←
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <Link href="/calendar" className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">
            Today
          </Link>
        </div>
        <Link
          href={monthHref(year, month + 1)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Next month"
        >
          →
        </Link>
      </div>

      {/* Month grid */}
      <div role="grid" className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-700">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            role="columnheader"
            className="bg-zinc-100 dark:bg-zinc-800 py-2 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            {weekday}
          </div>
        ))}
        {weeks.flat().map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="bg-zinc-50 dark:bg-zinc-900 min-h-24" />;
          }
          const date = toISODate(year, month, day);
          const dayTasks = tasksByDate.get(date) ?? [];
          const isToday = date === today;
          const isSelected = date === selectedDate;
          return (
            <div
              key={date}
              role="gridcell"
              aria-selected={isSelected}
              onClick={() => setSelectedDate(isSelected ? null : date)}
              className={`min-h-24 p-1.5 cursor-pointer text-left bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 ${
                isSelected ? 'ring-2 ring-inset ring-zinc-500' : ''
              }`}
            >
              <div
                className={`text-xs mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {day}
              </div>
              <ul className="space-y-0.5">
                {dayTasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-1">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => onToggle(task)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={task.completed ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
                      className="mt-0.5 h-3 w-3 flex-shrink-0 accent-zinc-900 dark:accent-zinc-50"
                    />
                    <span
                      className={`text-xs leading-tight break-words ${
                        task.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'
                      }`}
                    >
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Selected day panel */}
      {selectedDate && (
        <section className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
            Tasks due {selectedDate}
          </h3>

          <ul className="space-y-2 mb-4">
            {selectedTasks.length === 0 && (
              <li className="text-sm text-zinc-400">Nothing due on this day.</li>
            )}
            {selectedTasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-3">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => onToggle(task)}
                  aria-label={task.completed ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
                  className="h-4 w-4 accent-zinc-900 dark:accent-zinc-50"
                />
                <span
                  className={`flex-1 text-sm ${
                    task.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'
                  }`}
                >
                  {task.title}
                </span>
                <input
                  type="date"
                  defaultValue={task.due_date ?? ''}
                  onChange={(event) => {
                    if (event.target.value) onReschedule(task, event.target.value);
                  }}
                  aria-label={`Due date for "${task.title}"`}
                  className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-zinc-50"
                />
                <button
                  type="button"
                  onClick={() => onReschedule(task, null)}
                  className="text-xs text-zinc-500 hover:underline"
                >
                  Clear date
                </button>
              </li>
            ))}
          </ul>

          <form
            key={selectedDate}
            action={(formData) => {
              startTransition(() => createTask(formData));
            }}
            className="flex gap-2"
          >
            <input type="hidden" name="due_date" value={selectedDate} />
            <input
              name="title"
              type="text"
              required
              placeholder={`Add a task due ${selectedDate}...`}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 dark:bg-zinc-50 px-4 py-1.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              Add
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
