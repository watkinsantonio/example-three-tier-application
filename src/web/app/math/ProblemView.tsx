'use client';

import { useState, type FormEvent } from 'react';
import type { ProblemInstance } from './types.ts';

interface Props {
  problem: ProblemInstance;
  /** Return an error message to show under the form, or null when the answer was accepted. */
  onSubmit: (response: string) => string | null;
  disabled?: boolean;
  submitLabel?: string;
}

const buttonClass =
  'px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 font-medium disabled:opacity-50';
const smallButtonClass =
  'w-9 h-9 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 disabled:opacity-30';

const PLACEHOLDERS: Record<string, string> = {
  numeric: 'Type a number',
  fraction: 'Type a fraction like 3/4',
  expression: 'Type an expression like 5x+3',
};

/** Renders one problem and collects the answer. Mount it with a `key` so it resets for each new problem. */
export default function ProblemView({ problem, onSubmit, disabled = false, submitLabel = 'Check answer' }: Props) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState('');
  const [order, setOrder] = useState<string[]>(problem.choices ?? []);
  const [error, setError] = useState<string | null>(null);

  function move(index: number, delta: number) {
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (disabled) return;
    const response =
      problem.type === 'multiple_choice' ? choice : problem.type === 'drag' ? order.join('|') : text.trim();
    setError(onSubmit(response));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 whitespace-pre-line">{problem.prompt}</p>

      {problem.type === 'multiple_choice' && (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="sr-only">Choose an answer</legend>
          {(problem.choices ?? []).map((option) => (
            <label
              key={option}
              className="flex items-center gap-3 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-3 text-lg text-zinc-900 dark:text-zinc-50"
            >
              <input
                type="radio"
                name="choice"
                value={option}
                checked={choice === option}
                onChange={() => setChoice(option)}
              />
              {option}
            </label>
          ))}
        </fieldset>
      )}

      {problem.type === 'drag' && (
        <ol className="space-y-2" aria-label="Items to put in order">
          {order.map((item, index) => (
            <li
              key={item}
              className="flex items-center gap-3 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-lg text-zinc-900 dark:text-zinc-50"
            >
              <span className="flex-1">{item}</span>
              <button
                type="button"
                className={smallButtonClass}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                aria-label={`Move ${item} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className={smallButtonClass}
                disabled={disabled || index === order.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Move ${item} down`}
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
      )}

      {(problem.type === 'numeric' || problem.type === 'fraction' || problem.type === 'expression') && (
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          maxLength={80}
          inputMode={problem.type === 'numeric' ? 'decimal' : 'text'}
          autoComplete="off"
          spellCheck={false}
          aria-label="Your answer"
          placeholder={PLACEHOLDERS[problem.type]}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-lg text-zinc-900 dark:text-zinc-50"
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button type="submit" className={buttonClass} disabled={disabled}>
        {submitLabel}
      </button>
    </form>
  );
}
