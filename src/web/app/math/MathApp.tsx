'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  GUARDIAN_AGE_LIMIT,
  MAX_NAME_LENGTH,
  activePlacement,
  createLearner,
  deleteLearner,
  emptyState,
  needsGuardian,
  nextActivity,
  skillProgress,
  startPlacement,
  type Activity,
} from './engine.ts';
import { newId, newSeed, percent } from './ids.ts';
import PlacementSession from './PlacementSession.tsx';
import PracticeSession from './PracticeSession.tsx';
import { loadState, saveState, type KeyValueStorage, type LoadStatus } from './storage.ts';
import type { Learner, MathState } from './types.ts';

type Screen =
  | { name: 'home' }
  | { name: 'practice'; activity: Activity }
  | { name: 'placement'; sessionId: string };

function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const primaryButton =
  'px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 font-medium disabled:opacity-50';
const secondaryButton =
  'px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-zinc-100 font-medium';
const inputClass =
  'w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-50';

const STATUS_LABEL = { locked: 'Locked', learning: 'Learning', mastered: 'Mastered' } as const;
const STATUS_STYLE = {
  locked: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  learning: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
  mastered: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100',
} as const;

export default function MathApp() {
  const [state, setState] = useState<MathState | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('empty');
  const [storageOk, setStorageOk] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const readOnly = useRef(false);

  useEffect(() => {
    const storage = browserStorage();
    if (!storage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser store has to happen after mount
      setStorageOk(false);
      setState(emptyState());
      return;
    }
    const loaded = loadState(storage);
    readOnly.current = loaded.status === 'newer' || loaded.status === 'unavailable';
    setLoadStatus(loaded.status);
    setState(loaded.state);
  }, []);

  function commit(next: MathState) {
    setState(next);
    if (readOnly.current) return;
    const storage = browserStorage();
    setSaveError(storage ? saveState(storage, next) : 'Progress could not be saved in this browser.');
  }

  if (!state) return <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>;

  const learner = state.learners.find((l) => l.id === learnerId) ?? null;

  const notices = (
    <div className="space-y-2 mb-6">
      {!storageOk && (
        <p role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-950 px-4 py-2 text-amber-900 dark:text-amber-100">
          This browser is blocking local storage, so progress will be lost when you close the page.
        </p>
      )}
      {loadStatus === 'corrupt' && (
        <p role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-950 px-4 py-2 text-amber-900 dark:text-amber-100">
          Saved progress could not be read, so MathPath started fresh. A copy of the unreadable data was kept in this
          browser under &ldquo;mathpath.v1.unreadable&rdquo;.
        </p>
      )}
      {loadStatus === 'unavailable' && (
        <p role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-950 px-4 py-2 text-amber-900 dark:text-amber-100">
          Saved progress could not be read from this browser. To avoid overwriting it, nothing you do on this page will
          be saved. Reload the page to try again.
        </p>
      )}
      {loadStatus === 'newer' && (
        <p role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-950 px-4 py-2 text-amber-900 dark:text-amber-100">
          Saved progress was written by a newer version of MathPath. It is left untouched, and nothing you do on this
          page will be saved.
        </p>
      )}
      {saveError && (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-950 px-4 py-2 text-red-900 dark:text-red-100">
          {saveError}
        </p>
      )}
    </div>
  );

  if (!learner) {
    return (
      <>
        {notices}
        <LearnerPicker
          state={state}
          onSelect={(id) => {
            setLearnerId(id);
            setScreen({ name: 'home' });
          }}
          onCreate={(next, id) => {
            commit(next);
            setLearnerId(id);
            setScreen({ name: 'home' });
          }}
        />
      </>
    );
  }

  function exit() {
    setScreen({ name: 'home' });
  }

  if (screen.name === 'practice') {
    return (
      <>
        {notices}
        <PracticeSession state={state} learner={learner} initial={screen.activity} commit={commit} onExit={exit} />
      </>
    );
  }
  if (screen.name === 'placement') {
    return (
      <>
        {notices}
        <PlacementSession state={state} learner={learner} sessionId={screen.sessionId} commit={commit} onExit={exit} />
      </>
    );
  }

  return (
    <>
      {notices}
      <Dashboard
        state={state}
        learner={learner}
        onSwitch={() => setLearnerId(null)}
        onDelete={() => {
          commit(deleteLearner(state, learner.id));
          setLearnerId(null);
        }}
        onPractice={(skillId) => {
          const activity = nextActivity(state, learner.id, new Date(), newSeed(), skillId);
          if (activity) setScreen({ name: 'practice', activity });
        }}
        onPlacement={() => {
          const existing = activePlacement(state, learner.id);
          if (existing) {
            setScreen({ name: 'placement', sessionId: existing.id });
            return;
          }
          const started = startPlacement(state, learner.id, newId(), new Date());
          if ('error' in started) return;
          commit(started.state);
          setScreen({ name: 'placement', sessionId: started.session.id });
        }}
      />
    </>
  );
}

function LearnerPicker({
  state,
  onSelect,
  onCreate,
}: {
  state: MathState;
  onSelect: (id: string) => void;
  onCreate: (next: MathState, id: string) => void;
}) {
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [guardian, setGuardian] = useState('');
  const [error, setError] = useState<string | null>(null);
  const yearNumber = Number(year);
  const showGuardian = year.trim() !== '' && Number.isInteger(yearNumber) && yearNumber > 1000 && needsGuardian(yearNumber, new Date());

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const now = new Date();
    const result = createLearner(
      state,
      { display_name: name, birth_year: year.trim() === '' ? NaN : yearNumber, guardian_name: guardian },
      { learner: newId(), guardian: newId() },
      now,
    );
    if ('error' in result) {
      setError(result.error);
      return;
    }
    onCreate(result.state, result.learner.id);
  }

  return (
    <div className="space-y-8">
      {state.learners.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Who is practising?</h2>
          <ul className="space-y-2">
            {state.learners.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => onSelect(l.id)} className={`${secondaryButton} w-full text-left`}>
                  {l.display_name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {state.learners.length > 0 ? 'Add a learner' : 'Welcome to MathPath'}
        </h2>
        {state.learners.length === 0 && (
          <p className="text-zinc-600 dark:text-zinc-400">
            Short, friendly practice that adapts to you. Progress is saved in this browser only; nothing is sent
            anywhere.
          </p>
        )}
        <label className="block text-sm text-zinc-700 dark:text-zinc-300">
          Display name
          <input
            className={inputClass}
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="block text-sm text-zinc-700 dark:text-zinc-300">
          Birth year
          <input
            className={inputClass}
            value={year}
            inputMode="numeric"
            maxLength={4}
            onChange={(e) => setYear(e.target.value)}
            autoComplete="off"
          />
        </label>
        {showGuardian && (
          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Parent or guardian name (required for learners under {GUARDIAN_AGE_LIMIT}, judged by birth year)
            <input
              className={inputClass}
              value={guardian}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setGuardian(e.target.value)}
              autoComplete="off"
            />
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="submit" className={primaryButton}>
          Start learning
        </button>
      </form>
    </div>
  );
}

function Dashboard({
  state,
  learner,
  onSwitch,
  onDelete,
  onPractice,
  onPlacement,
}: {
  state: MathState;
  learner: Learner;
  onSwitch: () => void;
  onDelete: () => void;
  onPractice: (skillId?: string) => void;
  onPlacement: () => void;
}) {
  const [now] = useState(() => new Date());
  const progress = skillProgress(state, learner.id, now);
  const mastered = progress.filter((p) => p.mastery.status === 'mastered').length;
  const reviewsDue = progress.filter((p) => p.review_due).length;
  const hasStarted = state.attempts.some((a) => a.learner_id === learner.id) || mastered > 0;
  const placement = activePlacement(state, learner.id);
  const canContinue = progress.some((p) => p.mastery.status === 'learning' || p.review_due);
  const guardian = state.guardians.find((g) => g.id === learner.guardian_id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Hi, {learner.display_name}!</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {mastered} of {progress.length} skills mastered
            {reviewsDue > 0 ? ` · ${reviewsDue} due for review` : ''}
            {guardian ? ` · Guardian: ${guardian.name}` : ''}
          </p>
        </div>
        <button type="button" onClick={onSwitch} className="text-sm underline text-zinc-600 dark:text-zinc-400">
          Switch learner
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => onPractice()} disabled={!canContinue} className={primaryButton}>
          {hasStarted ? 'Continue practising' : 'Start practising'}
        </button>
        <button type="button" onClick={onPlacement} className={secondaryButton}>
          {placement ? 'Resume placement check' : hasStarted ? 'Take a placement check' : 'Find my level'}
        </button>
      </div>

      <ul className="space-y-3">
        {progress.map(({ skill, mastery, review_due }) => (
          <li
            key={skill.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{skill.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {skill.track} · {skill.grade_band}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLE[mastery.status]}`}>
                {review_due ? 'Review due' : STATUS_LABEL[mastery.status]}
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{skill.description}</p>
            {mastery.status !== 'locked' && (
              <div className="flex items-center gap-3">
                <div
                  className="h-2 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700"
                  role="progressbar"
                  aria-label={`${skill.name} mastery`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(mastery.p_mastery * 100)}
                >
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: percent(mastery.p_mastery) }} />
                </div>
                <button
                  type="button"
                  onClick={() => onPractice(skill.id)}
                  className="text-sm underline text-zinc-700 dark:text-zinc-300"
                >
                  Practise
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete ${learner.display_name} and all of their progress? This cannot be undone.`)) onDelete();
          }}
          className="text-sm underline text-red-600 dark:text-red-400"
        >
          Delete this learner
        </button>
      </div>
    </div>
  );
}
