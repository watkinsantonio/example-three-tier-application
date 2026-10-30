'use client';

import { buildProblem, getSkill } from './curriculum.ts';
import { answerPlacement, finishPlacement, placementNext } from './engine.ts';
import ProblemView from './ProblemView.tsx';
import type { Learner, MathState } from './types.ts';

interface Props {
  state: MathState;
  learner: Learner;
  sessionId: string;
  commit: (next: MathState) => void;
  onExit: () => void;
}

/** A short placement check: no hints, no answers shown, stops as soon as it knows where to start. */
export default function PlacementSession({ state, learner, sessionId, commit, onExit }: Props) {
  const session = state.placements.find((p) => p.id === sessionId);

  if (!session) {
    return (
      <section className="space-y-4">
        <p className="text-zinc-900 dark:text-zinc-50">That placement check could not be found.</p>
        <button type="button" onClick={onExit} className="underline text-zinc-700 dark:text-zinc-300">
          Back to skills
        </button>
      </section>
    );
  }

  if (session.finished_at) {
    const known = session.result_skill_ids.map((id) => getSkill(id)?.name).filter(Boolean);
    return (
      <section className="space-y-4" role="status">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Placement check finished</h2>
        {known.length > 0 ? (
          <>
            <p className="text-zinc-900 dark:text-zinc-50">{learner.display_name} already knows:</p>
            <ul className="list-disc pl-6 text-zinc-900 dark:text-zinc-50">
              {known.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              These skills are marked mastered and will come back for a quick review in a few days.
            </p>
          </>
        ) : (
          <p className="text-zinc-900 dark:text-zinc-50">Let&apos;s start from the beginning — that&apos;s a great place to start.</p>
        )}
        <button
          type="button"
          onClick={onExit}
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 font-medium"
        >
          See skills
        </button>
      </section>
    );
  }

  const question = placementNext(session);
  if (!question) {
    // Nothing left to ask: close the session so the learner is not stuck.
    return (
      <section className="space-y-4">
        <button
          type="button"
          onClick={() => commit(finishPlacement(state, sessionId, new Date()))}
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 font-medium"
        >
          See my results
        </button>
      </section>
    );
  }

  const problem = buildProblem(question.template_id, question.seed);

  function handleSubmit(response: string): string | null {
    const step = answerPlacement(state, sessionId, question!, response, new Date());
    if ('error' in step) return step.error;
    commit(step.state);
    return null;
  }

  return (
    <section className="space-y-6">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        <p>Placement check · question {session.answers.length + 1}</p>
        <p>Answer as best you can. It stops as soon as we know where to start, and no hints are shown.</p>
      </div>
      <ProblemView
        key={`${question.template_id}:${question.seed}`}
        problem={problem}
        onSubmit={handleSubmit}
        submitLabel="Next"
      />
      <div className="flex gap-4 text-sm">
        <button
          type="button"
          onClick={() => commit(finishPlacement(state, sessionId, new Date()))}
          className="underline text-zinc-600 dark:text-zinc-400"
        >
          Stop here and see results
        </button>
        <button type="button" onClick={onExit} className="underline text-zinc-600 dark:text-zinc-400">
          Pause
        </button>
      </div>
    </section>
  );
}
