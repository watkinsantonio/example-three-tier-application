import type { ProblemType, SkillMastery } from './types.ts';

// Bayesian Knowledge Tracing parameters.
export const P_INIT = 0.2; // prior chance a learner already knows a skill
export const P_LEARN = 0.15; // chance of learning the skill on each practice step
export const P_SLIP = 0.1; // chance of a wrong answer despite knowing the skill
export const MASTERY_P = 0.95;
export const MASTERY_STREAK = 3;
/** Review gaps once a skill is mastered, indexed by (streak - MASTERY_STREAK). */
export const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 14, 30];
export const PLACEMENT_REVIEW_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Chance of answering correctly by guessing, for the given question type. */
export function guessRate(type: ProblemType, choiceCount = 0): number {
  if (type === 'multiple_choice') return choiceCount > 1 ? 1 / choiceCount : 0.25;
  if (type === 'drag') return 0.05;
  return 0.1;
}

export function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * DAY_MS).toISOString();
}

export function reviewDays(streak: number): number {
  const i = Math.min(Math.max(streak - MASTERY_STREAK, 0), REVIEW_INTERVAL_DAYS.length - 1);
  return REVIEW_INTERVAL_DAYS[i];
}

export function newMastery(learnerId: string, skillId: string): SkillMastery {
  return {
    learner_id: learnerId,
    skill_id: skillId,
    p_mastery: P_INIT,
    streak: 0,
    last_practiced_at: null,
    next_review_at: null,
    status: 'learning',
  };
}

export interface AttemptEvidence {
  is_correct: boolean;
  hints_used: number;
  guess: number;
}

/**
 * Update mastery after one attempt.
 *
 * - A correct answer with no hints is full evidence and extends the streak.
 * - A correct answer after hints is not evidence of mastery: p only moves by the learning step and the streak is unchanged.
 * - A wrong answer lowers p and resets the streak.
 * - Mastery is sticky: once mastered, a wrong answer lowers p and schedules an immediate review but the skill
 *   stays mastered, so dependent skills do not re-lock.
 * `status` is left as 'learning' or 'mastered'; locking is derived from prerequisites by the engine.
 */
export function applyAttempt(prev: SkillMastery, evidence: AttemptEvidence, now: Date): SkillMastery {
  const p = prev.p_mastery;
  const g = evidence.guess;
  let posterior: number;
  let streak = prev.streak;
  const clean = evidence.is_correct && evidence.hints_used === 0;
  if (clean) {
    posterior = (p * (1 - P_SLIP)) / (p * (1 - P_SLIP) + (1 - p) * g);
    streak += 1;
  } else if (evidence.is_correct) {
    posterior = p;
  } else {
    posterior = (p * P_SLIP) / (p * P_SLIP + (1 - p) * (1 - g));
    streak = 0;
  }
  const next = Math.min(0.99, Math.max(0.01, posterior + (1 - posterior) * P_LEARN));

  const wasMastered = prev.status === 'mastered';
  const mastered = wasMastered || (next >= MASTERY_P && streak >= MASTERY_STREAK);

  let next_review_at: string | null = null;
  if (mastered) {
    if (!evidence.is_correct) next_review_at = now.toISOString();
    else if (clean) next_review_at = addDays(now, reviewDays(streak));
    else next_review_at = prev.next_review_at ?? addDays(now, 1);
  }

  return {
    ...prev,
    p_mastery: next,
    streak,
    last_practiced_at: now.toISOString(),
    next_review_at,
    status: mastered ? 'mastered' : 'learning',
  };
}

/** Mark a skill mastered from a placement check (never lowers existing mastery). */
export function placeAsMastered(prev: SkillMastery, now: Date): SkillMastery {
  if (prev.status === 'mastered') return prev;
  return {
    ...prev,
    p_mastery: Math.max(prev.p_mastery, MASTERY_P),
    streak: Math.max(prev.streak, MASTERY_STREAK),
    last_practiced_at: now.toISOString(),
    next_review_at: addDays(now, PLACEMENT_REVIEW_DAYS),
    status: 'mastered',
  };
}
