import { expressionsEquivalent } from './expression.ts';
import { fractionsEqual, parseFraction, parseNumber } from './grading.ts';
import { shuffle, type Rng } from './rng.ts';
import type {
  GeneratedProblem,
  MisconceptionCheck,
  Params,
  ProblemTemplate,
  ProblemType,
} from './types.ts';

export const num = (p: Params, key: string): number => Number(p[key]);

export function check(
  id: string,
  description: string,
  feedback: string,
  detect: MisconceptionCheck['detect'],
): MisconceptionCheck {
  return { id, description, feedback, detect };
}

/** Is the response numerically equal to value? */
export function numIs(response: string, value: number): boolean {
  const r = parseNumber(response);
  return r !== null && Math.abs(r - value) <= 1e-9 * Math.max(1, Math.abs(value));
}

/** Is the response a fraction equal in value to n/d (reduced or not)? */
export function fracIs(response: string, n: number, d: number): boolean {
  const r = parseFraction(response);
  return r !== null && fractionsEqual(r, { n, d });
}

export function equivTo(response: string, expression: string): boolean {
  return expressionsEquivalent(response, expression);
}

/** Correct choice plus up to 3 distinct distractors from candidates, shuffled. */
export function makeChoices(rng: Rng, correct: string, candidates: string[]): string[] {
  const distractors: string[] = [];
  for (const c of candidates) {
    if (c !== correct && !distractors.includes(c) && distractors.length < 3) distractors.push(c);
  }
  return shuffle(rng, [correct, ...distractors]);
}

export function template(
  id: string,
  skill_id: string,
  difficulty: ProblemTemplate['difficulty'],
  type: ProblemType,
  generator: (rng: Rng) => GeneratedProblem,
  hint_steps: (p: Params) => string[],
  explanation: (p: Params, answer: string) => string,
  misconception_checks: MisconceptionCheck[] = [],
): ProblemTemplate {
  return { id, skill_id, difficulty, type, generator, hint_steps, explanation, misconception_checks };
}
