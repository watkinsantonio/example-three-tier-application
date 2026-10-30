'use client';

import { useRef, useState } from 'react';
import { getSkill } from './curriculum.ts';
import { nextActivity, presentProblem, submitAttempt, type Activity, type AttemptResult } from './engine.ts';
import { newId, newSeed, percent } from './ids.ts';
import ProblemView from './ProblemView.tsx';
import type { Learner, MathState } from './types.ts';

interface Props {
  state: MathState;
  learner: Learner;
  initial: Activity;
  commit: (next: MathState) => void;
  onExit: () => void;
}

export default function PracticeSession({ state, learner, initial, commit, onExit }: Props) {
  const [activity, setActivity] = useState<Activity | null>(initial);
  const [hintsShown, setHintsShown] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const startedAt = useRef<number | null>(null);

  const skillId = initial.reason === 'chosen' ? initial.skill_id : undefined;

  if (!activity) {
    return (
      <section className="space-y-4">
        <p className="text-lg text-zinc-900 dark:text-zinc-50">
          Nothing left to practise right now. Great work, {learner.display_name}!
        </p>
        <button type="button" onClick={onExit} className="underline text-zinc-700 dark:text-zinc-300">
          Back to skills
        </button>
      </section>
    );
  }

  const { problem, hints } = presentProblem(activity.template_id, activity.seed);
  const skill = getSkill(activity.skill_id);

  function handleSubmit(response: string): string | null {
    if (!activity) return null;
    const timeMs = startedAt.current === null ? 0 : Date.now() - startedAt.current;
    const outcome = submitAttempt(
      state,
      learner.id,
      { template_id: activity.template_id, seed: activity.seed, response, time_ms: timeMs, hints_used: hintsShown },
      newId(),
      new Date(),
    );
    if ('error' in outcome) return outcome.error;
    commit(outcome.state);
    setResult(outcome.result);
    setScore((s) => ({ right: s.right + (outcome.result.is_correct ? 1 : 0), total: s.total + 1 }));
    return null;
  }

  function handleNext() {
    const next = nextActivity(state, learner.id, new Date(), newSeed(), skillId);
    setActivity(next);
    setResult(null);
    setHintsShown(0);
    startedAt.current = Date.now();
  }

  function markShown() {
    if (startedAt.current === null) startedAt.current = Date.now();
  }

  return (
    <section className="space-y-6" onFocus={markShown} onClick={markShown}>
      <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>
          {skill?.name} ·{' '}
          {activity.reason === 'review' ? 'Review' : activity.reason === 'chosen' ? 'Practice' : 'Learning'}
        </span>
        <span>
          {score.right}/{score.total} correct
        </span>
      </div>

      <ProblemView key={`${activity.template_id}:${activity.seed}`} problem={problem} onSubmit={handleSubmit} disabled={result !== null} />

      {result === null && hints.length > 0 && (
        <div className="space-y-2">
          {hints.slice(0, hintsShown).map((hint, i) => (
            <p key={i} className="rounded-lg bg-amber-50 dark:bg-amber-950 px-4 py-2 text-amber-900 dark:text-amber-100">
              Hint {i + 1}: {hint}
            </p>
          ))}
          {hintsShown < hints.length && (
            <button
              type="button"
              onClick={() => setHintsShown((n) => n + 1)}
              className="text-sm underline text-zinc-700 dark:text-zinc-300"
            >
              {hintsShown === 0 ? 'Show a hint' : 'Show another hint'}
            </button>
          )}
        </div>
      )}

      {result && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 space-y-2 ${
            result.is_correct
              ? 'bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100'
              : 'bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100'
          }`}
        >
          <p className="font-semibold">
            {result.is_correct ? 'Correct!' : `Not quite. The answer is ${result.correct_answer.split('|').join(', ')}.`}
          </p>
          {result.misconception && <p>{result.misconception.feedback}</p>}
          {!result.is_correct && <p>{result.explanation}</p>}
          {result.newly_mastered && <p className="font-semibold">You mastered {skill?.name}!</p>}
          <p className="text-sm">Mastery of this skill: {percent(result.mastery.p_mastery)}</p>
          <div className="flex gap-4 pt-1">
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 font-medium"
            >
              Next problem
            </button>
            <button type="button" onClick={onExit} className="underline">
              Stop for now
            </button>
          </div>
        </div>
      )}

      {result === null && (
        <button type="button" onClick={onExit} className="text-sm underline text-zinc-600 dark:text-zinc-400">
          Stop for now
        </button>
      )}
    </section>
  );
}
