import { formatFraction, gcd } from './grading.ts';
import { int, pick, shuffle, type Rng } from './rng.ts';
import { check, fracIs, makeChoices, num, template } from './template-helpers.ts';
import type { ProblemTemplate } from './types.ts';

const addedDenominators = check(
  'added_denominators',
  'Added the numerators and the denominators',
  'When you add fractions, the denominator names the size of the pieces, so it does not get added. Use a common denominator and add only the numerators.',
  (r, p) => fracIs(r, num(p, 'n1') + num(p, 'n2'), num(p, 'd1') + num(p, 'd2')),
);

/** A random fraction n/d with n < d that is already in simplest form. */
function reducedFraction(rng: Rng, minD: number, maxD: number): { n: number; d: number } {
  for (;;) {
    const d = int(rng, minD, maxD);
    const n = int(rng, 1, d - 1);
    if (gcd(n, d) === 1) return { n, d };
  }
}

const value = (f: string) => {
  const [n, d] = f.split('/').map(Number);
  return n / d;
};

export const FRACTION_TEMPLATES: ProblemTemplate[] = [
  // ---- 3.frac.intro ----
  template(
    '3.frac.intro.name',
    '3.frac.intro',
    1,
    'multiple_choice',
    (rng) => {
      const d = int(rng, 3, 8);
      const n = int(rng, 1, d - 1);
      const correct = `${n}/${d}`;
      return {
        prompt: `A bar is split into ${d} equal parts and ${n} of them are shaded. What fraction of the bar is shaded?`,
        answer: correct,
        params: { n, d },
        choices: makeChoices(rng, correct, [
          `${n}/${d - n}`,
          `${d - n}/${d}`,
          `${d}/${n}`,
          `${n}/${d + 1}`,
          `${n + 1}/${d}`,
        ]),
      };
    },
    (p) => [
      `The bottom number says how many equal parts there are in all: ${num(p, 'd')}.`,
      `The top number says how many parts are shaded: ${num(p, 'n')}.`,
    ],
    (p, answer) => `${num(p, 'n')} of ${num(p, 'd')} equal parts are shaded, so the fraction is ${answer}.`,
    [
      check(
        'part_to_part',
        'Compared the shaded parts to the unshaded parts instead of to the whole',
        'The bottom number counts all the parts, shaded and not shaded.',
        (r, p) => fracIs(r, num(p, 'n'), num(p, 'd') - num(p, 'n')),
      ),
    ],
  ),
  template(
    '3.frac.intro.left',
    '3.frac.intro',
    2,
    'fraction',
    (rng) => {
      const d = pick(rng, [3, 5, 7]);
      const n = int(rng, 1, d - 1);
      return {
        prompt: `A pizza is cut into ${d} equal slices and you eat ${n} of them. What fraction of the pizza is left?`,
        answer: `${d - n}/${d}`,
        params: { n, d },
      };
    },
    (p) => [`There are ${num(p, 'd')} slices in all. How many are left?`, 'Write that number over the total number of slices.'],
    (p, answer) => `${num(p, 'd') - num(p, 'n')} of the ${num(p, 'd')} slices are left: ${answer}.`,
    [
      check('gave_eaten', 'Gave the fraction eaten instead of the fraction left', 'That is the part you ate. The question asks what is left.', (r, p) =>
        fracIs(r, num(p, 'n'), num(p, 'd')),
      ),
    ],
  ),

  // ---- 4.frac.compare ----
  template(
    '4.frac.compare.samedenom',
    '4.frac.compare',
    2,
    'multiple_choice',
    (rng) => {
      const d = int(rng, 4, 9);
      const a = int(rng, 1, d - 1);
      let b = int(rng, 1, d - 1);
      if (b === a) b = a === d - 1 ? a - 1 : a + 1;
      const big = Math.max(a, b);
      return {
        prompt: `Which fraction is larger: ${a}/${d} or ${b}/${d}?`,
        answer: `${big}/${d}`,
        params: { a, b, d },
        choices: shuffle(rng, [`${a}/${d}`, `${b}/${d}`]),
      };
    },
    (p) => [`Both fractions have ${num(p, 'd')} equal parts, so compare how many parts each one has.`],
    (p, answer) => `The pieces are the same size, so the one with more pieces is larger: ${answer}.`,
  ),
  template(
    '4.frac.compare.samenumer',
    '4.frac.compare',
    3,
    'multiple_choice',
    (rng) => {
      const n = int(rng, 1, 3);
      const a = int(rng, 4, 12);
      let b = int(rng, 4, 12);
      if (b === a) b = a === 12 ? 11 : a + 1;
      const small = Math.min(a, b);
      return {
        prompt: `Which fraction is larger: ${n}/${a} or ${n}/${b}?`,
        answer: `${n}/${small}`,
        params: { n, a, b },
        choices: shuffle(rng, [`${n}/${a}`, `${n}/${b}`]),
      };
    },
    (p) => ['Both fractions have the same number of pieces. Compare the size of each piece.', 'The more pieces a whole is cut into, the smaller each piece is.'],
    (p, answer) => `With the same numerator, the smaller denominator means bigger pieces, so ${answer} is larger.`,
    [
      check(
        'bigger_denominator_bigger',
        'Thought a bigger denominator means a bigger fraction',
        'A bigger denominator means the whole is cut into more, smaller pieces.',
        (r, p) => {
          const bigger = Math.max(num(p, 'a'), num(p, 'b'));
          return r.trim() === `${num(p, 'n')}/${bigger}`;
        },
      ),
    ],
  ),
  template(
    '4.frac.compare.order',
    '4.frac.compare',
    4,
    'drag',
    (rng) => {
      const sameDenominator = rng() < 0.5;
      let items: string[];
      let params: { mode: string; k: number };
      if (sameDenominator) {
        const d = int(rng, 6, 10);
        const nums = shuffle(rng, Array.from({ length: d - 1 }, (_, i) => i + 1)).slice(0, 4);
        items = nums.map((n) => `${n}/${d}`);
        params = { mode: 'same denominator', k: d };
      } else {
        const n = int(rng, 1, 3);
        const dens = shuffle(rng, [4, 5, 6, 7, 8, 9, 10, 12]).slice(0, 4);
        items = dens.map((d) => `${n}/${d}`);
        params = { mode: 'same numerator', k: n };
      }
      const sorted = [...items].sort((x, y) => value(x) - value(y));
      let start = shuffle(rng, items);
      for (let tries = 0; tries < 10 && start.join('|') === sorted.join('|'); tries++) start = shuffle(rng, items);
      if (start.join('|') === sorted.join('|')) start = [...sorted.slice(1), sorted[0]];
      return {
        prompt: 'Put these fractions in order from smallest to largest.',
        answer: sorted.join('|'),
        params,
        choices: start,
      };
    },
    (p) =>
      p.mode === 'same denominator'
        ? ['The pieces are all the same size, so compare the numerators.']
        : ['The numerators match, so compare the size of the pieces: more pieces in the whole means smaller pieces.'],
    (_p, answer) => `From smallest to largest: ${answer.split('|').join(' < ')}.`,
    [
      check('reversed_order', 'Ordered from largest to smallest', 'Check the direction: start with the smallest fraction.', (r, _p) => {
        const parts = r.split('|');
        if (parts.length < 2) return false;
        const sorted = [...parts].sort((x, y) => value(y) - value(x));
        return parts.every((part, i) => part === sorted[i]);
      }),
    ],
  ),

  // ---- 4.frac.equiv ----
  template(
    '4.frac.equiv.missing',
    '4.frac.equiv',
    2,
    'numeric',
    (rng) => {
      const d = int(rng, 3, 9);
      const n = int(rng, 1, d - 1);
      const k = int(rng, 2, 5);
      return { prompt: `${n}/${d} = ?/${d * k}`, answer: String(n * k), params: { n, d, k } };
    },
    (p) => [
      `The bottom number was multiplied by ${num(p, 'k')} (${num(p, 'd')} × ${num(p, 'k')} = ${num(p, 'd') * num(p, 'k')}).`,
      'To keep the fraction equal, multiply the top number by the same amount.',
    ],
    (p, answer) => `Multiply top and bottom by ${num(p, 'k')}: ${num(p, 'n')}/${num(p, 'd')} = ${answer}/${num(p, 'd') * num(p, 'k')}.`,
    [
      check('added_same_amount', 'Added the same amount to top and bottom', 'Adding to the top and bottom changes the fraction. Multiply both by the same number.', (r, p) =>
        r.trim() === String(num(p, 'n') + num(p, 'd') * num(p, 'k') - num(p, 'd')),
      ),
    ],
  ),
  template(
    '4.frac.equiv.simplify',
    '4.frac.equiv',
    3,
    'fraction',
    (rng) => {
      const { n, d } = reducedFraction(rng, 2, 9);
      const g = int(rng, 2, 6);
      return {
        prompt: `Write ${n * g}/${d * g} in simplest form.`,
        answer: `${n}/${d}`,
        params: { n, d, g },
      };
    },
    (p) => [
      `Find a number that divides both ${num(p, 'n') * num(p, 'g')} and ${num(p, 'd') * num(p, 'g')}.`,
      'Keep dividing until no number other than 1 divides both.',
    ],
    (p, answer) => `Divide top and bottom by ${num(p, 'g')} to get ${answer}.`,
  ),
  template(
    '4.frac.equiv.choice',
    '4.frac.equiv',
    4,
    'multiple_choice',
    (rng) => {
      const { n, d } = reducedFraction(rng, 3, 9);
      const k = int(rng, 2, 4);
      const correct = `${n * k}/${d * k}`;
      return {
        prompt: `Which fraction is equivalent to ${n}/${d}?`,
        answer: correct,
        params: { n, d, k },
        choices: makeChoices(rng, correct, [
          `${n + k}/${d + k}`,
          `${n * k}/${d + k}`,
          `${n + k}/${d * k}`,
          `${n * k + 1}/${d * k}`,
        ]),
      };
    },
    (p) => ['Equivalent fractions come from multiplying top and bottom by the same number.'],
    (p, answer) => `Multiplying ${num(p, 'n')}/${num(p, 'd')} by ${num(p, 'k')}/${num(p, 'k')} gives ${answer}.`,
    [
      check('added_same_amount', 'Added the same amount to top and bottom', 'Adding the same number to top and bottom does not keep the fraction equal.', (r, p) =>
        r.trim() === `${num(p, 'n') + num(p, 'k')}/${num(p, 'd') + num(p, 'k')}`,
      ),
    ],
  ),

  // ---- 5.frac.add ----
  template(
    '5.frac.add.like',
    '5.frac.add',
    2,
    'fraction',
    (rng) => {
      const d = int(rng, 4, 10);
      const n1 = int(rng, 1, d - 2);
      const n2 = int(rng, 1, d - 1 - n1);
      return {
        prompt: `${n1}/${d} + ${n2}/${d} = ?  (simplest form)`,
        answer: formatFraction({ n: n1 + n2, d }),
        params: { n1, n2, d1: d, d2: d },
      };
    },
    (p) => ['The pieces are the same size, so just add the number of pieces.', 'Keep the denominator and simplify if you can.'],
    (p, answer) => `${num(p, 'n1')} + ${num(p, 'n2')} = ${num(p, 'n1') + num(p, 'n2')} pieces of size 1/${num(p, 'd1')}, which is ${answer}.`,
    [addedDenominators],
  ),
  template(
    '5.frac.add.multiple',
    '5.frac.add',
    3,
    'fraction',
    (rng) => {
      const d1 = int(rng, 2, 6);
      const m = int(rng, 2, 3);
      const d2 = d1 * m;
      const n1 = int(rng, 1, d1 - 1);
      const n2 = int(rng, 1, d2 - 1);
      return {
        prompt: `${n1}/${d1} + ${n2}/${d2} = ?  (simplest form)`,
        answer: formatFraction({ n: n1 * m + n2, d: d2 }),
        params: { n1, d1, n2, d2, m },
      };
    },
    (p) => [
      `Rewrite ${num(p, 'n1')}/${num(p, 'd1')} with denominator ${num(p, 'd2')}.`,
      `That gives ${num(p, 'n1') * num(p, 'm')}/${num(p, 'd2')}. Now add the numerators.`,
    ],
    (p, answer) => `${num(p, 'n1') * num(p, 'm')}/${num(p, 'd2')} + ${num(p, 'n2')}/${num(p, 'd2')} = ${answer}.`,
    [addedDenominators],
  ),
  template(
    '5.frac.add.unlike',
    '5.frac.add',
    4,
    'fraction',
    (rng) => {
      for (;;) {
        const d1 = int(rng, 2, 5);
        const d2 = pick(rng, [3, 5, 7]);
        if (d1 === d2 || gcd(d1, d2) !== 1) continue;
        const n1 = int(rng, 1, d1 - 1);
        const n2 = int(rng, 1, d2 - 1);
        return {
          prompt: `${n1}/${d1} + ${n2}/${d2} = ?  (simplest form)`,
          answer: formatFraction({ n: n1 * d2 + n2 * d1, d: d1 * d2 }),
          params: { n1, d1, n2, d2 },
        };
      }
    },
    (p) => [
      `Use ${num(p, 'd1') * num(p, 'd2')} as the common denominator.`,
      `${num(p, 'n1')}/${num(p, 'd1')} = ${num(p, 'n1') * num(p, 'd2')}/${num(p, 'd1') * num(p, 'd2')} and ${num(p, 'n2')}/${num(p, 'd2')} = ${num(p, 'n2') * num(p, 'd1')}/${num(p, 'd1') * num(p, 'd2')}.`,
    ],
    (p, answer) => `With a common denominator of ${num(p, 'd1') * num(p, 'd2')} the sum is ${answer}.`,
    [addedDenominators],
  ),
];
