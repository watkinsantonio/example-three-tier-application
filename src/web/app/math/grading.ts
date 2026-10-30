import { expressionsEquivalent, isWrittenSimply } from './expression.ts';
import type { MisconceptionCheck, ProblemInstance } from './types.ts';

export interface Fraction {
  n: number;
  d: number;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** Parse "3/4", "3 / 4", "-2/5" or a whole number. Returns null for anything else (decimals, d = 0, junk). */
export function parseFraction(text: string): Fraction | null {
  if (typeof text !== 'string') return null;
  const m = /^\s*(-?\d{1,9})\s*(?:\/\s*(-?\d{1,9}))?\s*$/.exec(text);
  if (!m) return null;
  let n = Number(m[1]);
  let d = m[2] === undefined ? 1 : Number(m[2]);
  if (d === 0) return null;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  return { n, d };
}

export function fractionsEqual(a: Fraction, b: Fraction): boolean {
  return a.n * b.d === b.n * a.d;
}

export function isReduced(f: Fraction): boolean {
  return gcd(f.n, f.d) === 1;
}

export function formatFraction(f: Fraction): string {
  const g = gcd(f.n, f.d);
  const n = f.n / g;
  const d = f.d / g;
  return d === 1 ? String(n) : `${n}/${d}`;
}

/** Parse a number typed by a learner: allows spaces and thousands commas, not junk like "12abc". */
export function parseNumber(text: string): number | null {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim().replace(/,(?=\d{3}(\D|$))/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
}

/** Is the response equal in value to the answer but not written in simplest form? (fraction / expression) */
export function isUnsimplifiedEquivalent(type: ProblemInstance['type'], response: string, answer: string): boolean {
  if (type === 'fraction') {
    const r = parseFraction(response);
    const a = parseFraction(answer);
    return !!r && !!a && fractionsEqual(r, a) && !isReduced(r);
  }
  if (type === 'expression') {
    return expressionsEquivalent(response, answer) && !isWrittenSimply(response, answer);
  }
  return false;
}

/** Grade a response against a problem instance. Pure; never throws on bad input (returns false). */
export function isCorrect(problem: Pick<ProblemInstance, 'type' | 'answer'>, response: string): boolean {
  if (typeof response !== 'string') return false;
  switch (problem.type) {
    case 'numeric': {
      const r = parseNumber(response);
      const a = parseNumber(problem.answer);
      return r !== null && a !== null && Math.abs(r - a) <= 1e-9 * Math.max(1, Math.abs(a));
    }
    case 'multiple_choice':
      return response.trim() === problem.answer;
    case 'drag':
      return response === problem.answer;
    case 'fraction': {
      const r = parseFraction(response);
      const a = parseFraction(problem.answer);
      // The answer is always stored in simplest form, so a correct response must be reduced too.
      return !!r && !!a && fractionsEqual(r, a) && isReduced(r);
    }
    case 'expression':
      return expressionsEquivalent(response, problem.answer) && isWrittenSimply(response, problem.answer);
  }
}

/** Id of the first misconception check that matches a wrong response, or null. */
export function detectMisconception(
  checks: readonly MisconceptionCheck[],
  problem: Pick<ProblemInstance, 'params'>,
  response: string,
): MisconceptionCheck | null {
  for (const check of checks) {
    try {
      if (check.detect(response, problem.params)) return check;
    } catch {
      // A broken detector must never block grading.
    }
  }
  return null;
}
