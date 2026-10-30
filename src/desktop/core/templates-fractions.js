'use strict';

const { gcd } = require('./grading');
const { fracStr, reduce } = require('./helpers');

const simple = (n, d) => {
  const r = reduce(n, d);
  return r.d === 1 ? String(r.n) : fracStr(r.n, r.d);
};

const isFrac = (r, n, d) => r && typeof r === 'object' && r.n === n && r.d === d;
const reversed = {
  id: 'reversed-order',
  label: 'Ordered largest to smallest',
  message: 'Right fractions, opposite order. The smallest fraction goes first.',
  test: (r, { answer }) => Array.isArray(r) && r.join('|') === [...answer].reverse().join('|'),
};

function coprimePair(rng, dLo, dHi) {
  for (;;) {
    const d = rng.int(dLo, dHi);
    const n = rng.int(1, d - 1);
    if (gcd(n, d) === 1) return { n, d };
  }
}

const EQUIV_TEMPLATES = [
  {
    id: '4.frac.equiv.scale',
    skill_id: '4.frac.equiv',
    difficulty: 2,
    type: 'fraction',
    generate(rng) {
      const { n, d } = coprimePair(rng, 2, 6);
      const k = rng.int(2, 5);
      return {
        params: { n, d, k },
        prompt: 'Write ' + fracStr(n, d) + ' as an equivalent fraction with a bottom number of ' + d * k + '.',
        answer: { n: n * k, d: d * k },
        mode: 'exact',
      };
    },
    hint_steps: ({ d, k }) => ['Ask: what do you multiply ' + d + ' by to get ' + d * k + '?', 'Whatever you do to the bottom, do the same to the top.'],
    explanation: ({ n, d, k }) => fracStr(n, d) + ' = ' + fracStr(n * k, d * k) + ' because top and bottom were both multiplied by ' + k + '.',
    misconception_checks: [
      {
        id: 'added-same-number',
        label: 'Added the same number to top and bottom',
        message: 'Adding to the top and bottom changes the amount. Multiply both by the same number instead.',
        test: (r, { params: { n, d, k } }) => isFrac(r, n + d * k - d, d * k),
      },
    ],
  },
  {
    id: '4.frac.equiv.simplify',
    skill_id: '4.frac.equiv',
    difficulty: 3,
    type: 'fraction',
    generate(rng) {
      const { n, d } = coprimePair(rng, 2, 9);
      const k = rng.int(2, 6);
      return {
        params: { n, d, k },
        prompt: 'Simplify ' + fracStr(n * k, d * k) + ' as far as you can.',
        answer: { n, d },
        mode: 'simplest',
      };
    },
    hint_steps: ({ n, d, k }) => ['Find a number that divides both the top and the bottom.', 'Keep dividing until only 1 divides both. Try ' + k + '.'],
    explanation: ({ n, d, k }) => fracStr(n * k, d * k) + ' = ' + fracStr(n, d) + ' after dividing top and bottom by ' + k + '.',
    misconception_checks: [],
  },
];

const COMPARE_TEMPLATES = [
  {
    id: '4.frac.compare.samenumerator',
    skill_id: '4.frac.compare',
    difficulty: 2,
    type: 'multiple_choice',
    generate(rng) {
      const n = rng.int(1, 5);
      const d1 = rng.int(n + 1, 9);
      let d2 = rng.int(n + 1, 9);
      if (d2 === d1) d2 = d1 === 9 ? d1 - 1 : d1 + 1;
      const [big, small] = d1 < d2 ? [d1, d2] : [d2, d1];
      return {
        params: { n, big, small },
        prompt: 'Which fraction is bigger?',
        choices: rng.shuffle([fracStr(n, big), fracStr(n, small)]),
        answer: fracStr(n, big),
      };
    },
    hint_steps: ({ n }) => ['Both fractions have ' + n + ' parts. Compare the size of each part.', 'The more pieces a whole is cut into, the smaller each piece is.'],
    explanation: ({ n, big, small }) => 'Same top number, so the smaller bottom number gives bigger pieces: ' + fracStr(n, big) + ' > ' + fracStr(n, small) + '.',
    misconception_checks: [
      {
        id: 'bigger-denominator',
        label: 'Thought a bigger bottom number means a bigger fraction',
        message: 'A bigger bottom number means the whole is cut into more, smaller pieces.',
        test: (r, { params: { n, small } }) => r === fracStr(n, small),
      },
    ],
  },
  {
    id: '4.frac.compare.unlike',
    skill_id: '4.frac.compare',
    difficulty: 3,
    type: 'multiple_choice',
    generate(rng) {
      for (;;) {
        const options = [];
        while (options.length < 3) {
          const d = rng.int(2, 10);
          const n = rng.int(1, d - 1);
          if (!options.some((o) => o.n * d === n * o.d)) options.push({ n, d });
        }
        const values = options.map((o) => o.n / o.d);
        const max = Math.max(...values);
        if (values.filter((v) => v === max).length !== 1) continue;
        const best = options[values.indexOf(max)];
        const biggestBottom = options.reduce((a, b) => (b.d > a.d ? b : a));
        if (biggestBottom === best) continue;
        return {
          params: { wrong: fracStr(biggestBottom.n, biggestBottom.d) },
          prompt: 'Which fraction is the greatest?',
          choices: options.map((o) => fracStr(o.n, o.d)),
          answer: fracStr(best.n, best.d),
        };
      }
    },
    hint_steps: () => ['Try comparing each fraction with 1/2.', 'Or rewrite them with a common bottom number.'],
    explanation: (p, { answer }) => answer + ' is the greatest. Compare them using a common denominator, or by how close each is to 1.',
    misconception_checks: [
      {
        id: 'bigger-denominator',
        label: 'Picked the fraction with the biggest bottom number',
        message: 'The bottom number only tells the size of the pieces, not how many you have. Compare the whole fractions.',
        test: (r, { params }) => r === params.wrong,
      },
    ],
  },
];

const ORDER_TEMPLATES = [
  {
    id: '4.frac.order.samebottom',
    skill_id: '4.frac.order',
    difficulty: 2,
    type: 'drag',
    generate(rng) {
      const d = rng.int(6, 12);
      const tops = new Set();
      while (tops.size < 4) tops.add(rng.int(1, d - 1));
      const sorted = [...tops].sort((a, b) => a - b).map((n) => fracStr(n, d));
      let items = rng.shuffle(sorted);
      if (items.join() === sorted.join()) items = items.reverse();
      return { params: { d }, prompt: 'Put these fractions in order, smallest first.', items, answer: sorted };
    },
    hint_steps: ({ d }) => ['All the pieces are the same size (1/' + d + '), so just count how many there are.'],
    explanation: (p, { answer }) => 'Same bottom number, so order by the top number: ' + answer.join(', ') + '.',
    misconception_checks: [reversed],
  },
  {
    id: '4.frac.order.unlike',
    skill_id: '4.frac.order',
    difficulty: 4,
    type: 'drag',
    generate(rng) {
      const list = [];
      while (list.length < 4) {
        const d = rng.pick([2, 3, 4, 5, 6, 8, 10]);
        const n = rng.int(1, d - 1);
        if (!list.some((o) => o.n * d === n * o.d)) list.push({ n, d });
      }
      const sorted = [...list].sort((a, b) => a.n / a.d - b.n / b.d).map((o) => fracStr(o.n, o.d));
      let items = rng.shuffle(sorted);
      if (items.join() === sorted.join()) items = items.reverse();
      return { params: {}, prompt: 'Put these fractions in order, smallest first.', items, answer: sorted };
    },
    hint_steps: () => ['Turn each fraction into a decimal, or use a common bottom number.', 'Compare with 1/2 to split them into "small" and "big".'],
    explanation: (p, { answer }) => 'In order: ' + answer.join(', ') + '.',
    misconception_checks: [reversed],
  },
];

function addLikeTemplate(id, difficulty, improper) {
  return {
    id,
    skill_id: '5.frac.add.like',
    difficulty,
    type: 'fraction',
    generate(rng) {
      const d = rng.int(4, 12);
      const a = improper ? rng.int(2, d - 1) : rng.int(1, Math.floor(d / 2));
      const b = improper ? rng.int(d - a + 1, d - 1) : rng.int(1, d - a);
      const ans = reduce(a + b, d);
      return {
        params: { a, b, d },
        prompt: fracStr(a, d) + ' + ' + fracStr(b, d) + ' = ?  (simplest form' + (improper ? '; the answer can be more than 1' : '') + ')',
        answer: ans,
        mode: 'simplest',
      };
    },
    hint_steps: ({ d }) => ['The pieces are the same size (1/' + d + '), so just count the pieces.', 'Add the tops. The bottom stays the same.', 'Then simplify if you can.'],
    explanation: ({ a, b, d }) => fracStr(a, d) + ' + ' + fracStr(b, d) + ' = ' + fracStr(a + b, d) + (gcd(a + b, d) > 1 ? ', which simplifies to ' + simple(a + b, d) : '') + '.',
    misconception_checks: [
      {
        id: 'added-denominators',
        label: 'Added the denominators',
        message: 'The bottom number names the size of the pieces. Adding does not change the size, so keep the bottom number.',
        test: (r, { params: { a, b, d } }) => isFrac(r, a + b, d + d),
      },
    ],
  };
}

function addUnlikeTemplate(id, difficulty, dens) {
  return {
    id,
    skill_id: '5.frac.add.unlike',
    difficulty,
    type: 'fraction',
    generate(rng) {
      let b;
      let d;
      do {
        b = rng.pick(dens);
        d = rng.pick(dens);
      } while (b === d);
      const a = rng.int(1, b - 1);
      const c = rng.int(1, d - 1);
      return {
        params: { a, b, c, d },
        prompt: fracStr(a, b) + ' + ' + fracStr(c, d) + ' = ?  (simplest form)',
        answer: reduce(a * d + c * b, b * d),
        mode: 'simplest',
      };
    },
    hint_steps: ({ b, d }) => ['The pieces are different sizes, so you cannot add yet.', 'Find a common bottom number, for example ' + b * d + '.', 'Rewrite both fractions, add the tops, then simplify.'],
    explanation: ({ a, b, c, d }) => fracStr(a, b) + ' = ' + fracStr(a * d, b * d) + ' and ' + fracStr(c, d) + ' = ' + fracStr(c * b, b * d) + ', so the sum is ' + fracStr(a * d + c * b, b * d) + ' (simplified if possible).',
    misconception_checks: [
      {
        id: 'added-denominators',
        label: 'Added tops and bottoms separately',
        message: 'You added the tops and the bottoms. First rewrite both fractions with the same bottom number.',
        test: (r, { params: { a, b, c, d } }) => isFrac(r, a + c, b + d),
      },
      {
        id: 'multiplied-denominators-only',
        label: 'Used a common bottom number but added the old tops',
        message: 'When you change the bottom number, the top changes too. Rewrite each fraction fully before adding.',
        test: (r, { params: { a, b, c, d } }) => isFrac(r, a + c, b * d),
      },
    ],
  };
}

const FRACTION_TEMPLATES = [
  ...EQUIV_TEMPLATES,
  ...COMPARE_TEMPLATES,
  ...ORDER_TEMPLATES,
  addLikeTemplate('5.frac.add.like.proper', 2, false),
  addLikeTemplate('5.frac.add.like.improper', 3, true),
  addUnlikeTemplate('5.frac.add.unlike.easy', 3, [2, 3, 4, 6]),
  addUnlikeTemplate('5.frac.add.unlike.hard', 5, [3, 4, 5, 6, 8, 9]),
];

module.exports = { FRACTION_TEMPLATES };
