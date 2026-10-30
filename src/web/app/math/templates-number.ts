import { int } from './rng.ts';
import { check, makeChoices, num, numIs, template } from './template-helpers.ts';
import type { ProblemTemplate } from './types.ts';

const addedInstead = check(
  'added_instead',
  'Added the two numbers instead of multiplying',
  'It looks like you added. Multiplication means that many equal groups.',
  (r, p) => num(p, 'a') + num(p, 'b') !== num(p, 'a') * num(p, 'b') && numIs(r, num(p, 'a') + num(p, 'b')),
);

export const NUMBER_TEMPLATES: ProblemTemplate[] = [
  // ---- 2.addsub.100 ----
  template(
    '2.addsub.100.add',
    '2.addsub.100',
    1,
    'numeric',
    (rng) => {
      const oa = int(rng, 0, 8);
      const ob = int(rng, 0, 9 - oa);
      const a = int(rng, 1, 4) * 10 + oa;
      const b = int(rng, 1, 4) * 10 + ob;
      return { prompt: `${a} + ${b} = ?`, answer: String(a + b), params: { a, b } };
    },
    (p) => [
      `Add the ones first: ${num(p, 'a') % 10} + ${num(p, 'b') % 10}.`,
      `Now add the tens: ${Math.floor(num(p, 'a') / 10) * 10} + ${Math.floor(num(p, 'b') / 10) * 10}.`,
    ],
    (p, answer) => `Add ones and tens separately and combine them: ${num(p, 'a')} + ${num(p, 'b')} = ${answer}.`,
  ),
  template(
    '2.addsub.100.carry',
    '2.addsub.100',
    2,
    'numeric',
    (rng) => {
      const oa = int(rng, 2, 9);
      const ob = int(rng, 10 - oa, 9);
      const a = int(rng, 1, 4) * 10 + oa;
      const b = int(rng, 1, 4) * 10 + ob;
      return { prompt: `${a} + ${b} = ?`, answer: String(a + b), params: { a, b } };
    },
    (p) => [
      `The ones add up to ${(num(p, 'a') % 10) + (num(p, 'b') % 10)}, which is 10 or more.`,
      'Write the ones digit and carry 1 ten to the tens column.',
    ],
    (p, answer) =>
      `The ones make more than 9, so you carry a ten: ${num(p, 'a')} + ${num(p, 'b')} = ${answer}.`,
    [
      check('forgot_carry', 'Forgot to carry the ten', 'Check the ones column: you need to carry a ten.', (r, p) =>
        numIs(r, num(p, 'a') + num(p, 'b') - 10),
      ),
    ],
  ),
  template(
    '2.addsub.100.borrow',
    '2.addsub.100',
    3,
    'numeric',
    (rng) => {
      const ta = int(rng, 3, 9);
      const tb = int(rng, 1, ta - 1);
      const oa = int(rng, 0, 7);
      const ob = int(rng, oa + 1, 9);
      const a = ta * 10 + oa;
      const b = tb * 10 + ob;
      return { prompt: `${a} − ${b} = ?`, answer: String(a - b), params: { a, b, ta, tb, oa, ob } };
    },
    (p) => [
      `${num(p, 'oa')} is smaller than ${num(p, 'ob')}, so you need to borrow a ten.`,
      `Borrow: ${num(p, 'oa') + 10} − ${num(p, 'ob')} in the ones column, and one fewer ten.`,
    ],
    (p, answer) => `Borrow a ten to subtract the ones: ${num(p, 'a')} − ${num(p, 'b')} = ${answer}.`,
    [
      check(
        'smaller_from_larger',
        'Subtracted the smaller digit from the larger in each column',
        'In the ones column you cannot just flip the subtraction. Borrow a ten instead.',
        (r, p) => numIs(r, (num(p, 'ta') - num(p, 'tb')) * 10 + (num(p, 'ob') - num(p, 'oa'))),
      ),
    ],
  ),

  // ---- 3.mult.facts ----
  template(
    '3.mult.facts.easy',
    '3.mult.facts',
    1,
    'numeric',
    (rng) => {
      const a = int(rng, 2, 5);
      const b = int(rng, 2, 9);
      return { prompt: `${a} × ${b} = ?`, answer: String(a * b), params: { a, b } };
    },
    (p) => [
      `Think of ${num(p, 'a')} groups of ${num(p, 'b')}.`,
      `Skip count by ${num(p, 'b')}: ${Array.from({ length: num(p, 'a') }, (_, i) => num(p, 'b') * (i + 1)).join(', ')}.`,
    ],
    (p, answer) => `${num(p, 'a')} groups of ${num(p, 'b')} make ${answer}.`,
    [addedInstead],
  ),
  template(
    '3.mult.facts.choice',
    '3.mult.facts',
    2,
    'multiple_choice',
    (rng) => {
      const a = int(rng, 3, 8);
      const b = int(rng, 3, 9);
      const correct = String(a * b);
      const choices = makeChoices(rng, correct, [
        String(a + b),
        String(a * b + a),
        String(a * b - b),
        String(a * b + 1),
        String(a * b - 1),
      ]);
      return { prompt: `What is ${a} × ${b}?`, answer: correct, params: { a, b }, choices };
    },
    (p) => [`Try skip counting by ${num(p, 'a')}, ${num(p, 'b')} times.`],
    (p, answer) => `${num(p, 'a')} × ${num(p, 'b')} = ${answer}.`,
    [addedInstead],
  ),
  template(
    '3.mult.facts.hard',
    '3.mult.facts',
    3,
    'numeric',
    (rng) => {
      const a = int(rng, 6, 9);
      const b = int(rng, 6, 9);
      return { prompt: `${a} × ${b} = ?`, answer: String(a * b), params: { a, b } };
    },
    (p) => [
      `Start from an easier fact: ${num(p, 'a')} × 5 = ${num(p, 'a') * 5}.`,
      `Then add ${num(p, 'b') - 5} more group${num(p, 'b') - 5 === 1 ? '' : 's'} of ${num(p, 'a')}.`,
    ],
    (p, answer) => `${num(p, 'a')} × ${num(p, 'b')} = ${answer}.`,
    [
      check('one_group_off', 'Added or dropped one whole group', 'Close! You may have used one group too many or too few.', (r, p) => {
        const a = num(p, 'a');
        const b = num(p, 'b');
        return [a * b + a, a * b - a, a * b + b, a * b - b].some((v) => numIs(r, v));
      }),
      addedInstead,
    ],
  ),
  template(
    '3.mult.facts.missing',
    '3.mult.facts',
    4,
    'numeric',
    (rng) => {
      const a = int(rng, 3, 9);
      const b = int(rng, 3, 9);
      return { prompt: `${a} × ? = ${a * b}`, answer: String(b), params: { a, b } };
    },
    (p) => [`How many groups of ${num(p, 'a')} make ${num(p, 'a') * num(p, 'b')}?`, 'Skip count until you reach the total.'],
    (p) => `${num(p, 'a')} × ${num(p, 'b')} = ${num(p, 'a') * num(p, 'b')}, so the missing number is ${num(p, 'b')}.`,
  ),
  template(
    '3.mult.facts.fluent',
    '3.mult.facts',
    5,
    'numeric',
    (rng) => {
      const a = int(rng, 7, 12);
      const b = int(rng, 7, 12);
      return { prompt: `${a} × ${b} = ?`, answer: String(a * b), params: { a, b } };
    },
    (p) => [
      `Start from ${num(p, 'a')} × 10 = ${num(p, 'a') * 10}.`,
      `${num(p, 'b')} is ${Math.abs(num(p, 'b') - 10)} ${num(p, 'b') >= 10 ? 'more' : 'fewer'} than 10, so ${num(p, 'b') >= 10 ? 'add' : 'take away'} that many groups of ${num(p, 'a')}.`,
    ],
    (p, answer) => `${num(p, 'a')} × ${num(p, 'b')} = ${answer}.`,
    [addedInstead],
  ),

  // ---- 3.div.facts ----
  template(
    '3.div.facts.basic',
    '3.div.facts',
    2,
    'numeric',
    (rng) => {
      const a = int(rng, 2, 9);
      const b = int(rng, 2, 9);
      return { prompt: `${a * b} ÷ ${a} = ?`, answer: String(b), params: { a, b } };
    },
    (p) => [`Think: ${num(p, 'a')} × ? = ${num(p, 'a') * num(p, 'b')}.`],
    (p) => `${num(p, 'a')} × ${num(p, 'b')} = ${num(p, 'a') * num(p, 'b')}, so ${num(p, 'a') * num(p, 'b')} ÷ ${num(p, 'a')} = ${num(p, 'b')}.`,
    [
      check('gave_divisor', 'Answered with the divisor', 'That is the number you divided by. How many groups of it fit?', (r, p) =>
        num(p, 'a') !== num(p, 'b') && numIs(r, num(p, 'a')),
      ),
    ],
  ),
  template(
    '3.div.facts.word',
    '3.div.facts',
    3,
    'numeric',
    (rng) => {
      const k = int(rng, 3, 9);
      const each = int(rng, 3, 9);
      return {
        prompt: `${k * each} pencils are shared equally among ${k} students. How many pencils does each student get?`,
        answer: String(each),
        params: { k, each },
      };
    },
    (p) => ['Sharing equally means dividing.', `What times ${num(p, 'k')} is ${num(p, 'k') * num(p, 'each')}?`],
    (p) => `${num(p, 'k') * num(p, 'each')} ÷ ${num(p, 'k')} = ${num(p, 'each')} pencils each.`,
    [
      check('subtracted', 'Subtracted instead of dividing', 'Sharing equally is division, not subtraction.', (r, p) =>
        numIs(r, num(p, 'k') * num(p, 'each') - num(p, 'k')),
      ),
    ],
  ),
  template(
    '3.div.facts.missing',
    '3.div.facts',
    4,
    'multiple_choice',
    (rng) => {
      const a = int(rng, 3, 9);
      const b = int(rng, 3, 9);
      const correct = String(a * b);
      return {
        prompt: `? ÷ ${a} = ${b}. What number goes in the blank?`,
        answer: correct,
        params: { a, b },
        choices: makeChoices(rng, correct, [String(a + b), String(a * b + a), String(a * b - b), String(b)]),
      };
    },
    (p) => ['Division undoes multiplication.', `Multiply ${num(p, 'a')} and ${num(p, 'b')}.`],
    (p, answer) => `${answer} ÷ ${num(p, 'a')} = ${num(p, 'b')} because ${num(p, 'a')} × ${num(p, 'b')} = ${answer}.`,
    [
      check('added_instead', 'Added the two numbers', 'Undo the division by multiplying, not adding.', (r, p) =>
        numIs(r, num(p, 'a') + num(p, 'b')),
      ),
    ],
  ),
  template(
    '3.div.facts.hard',
    '3.div.facts',
    5,
    'numeric',
    (rng) => {
      const a = int(rng, 6, 12);
      const b = int(rng, 6, 12);
      return { prompt: `${a * b} ÷ ${a} = ?`, answer: String(b), params: { a, b } };
    },
    (p) => [`Think: ${num(p, 'a')} × ? = ${num(p, 'a') * num(p, 'b')}.`],
    (p) => `${num(p, 'a')} × ${num(p, 'b')} = ${num(p, 'a') * num(p, 'b')}, so the quotient is ${num(p, 'b')}.`,
  ),

  // ---- 4.mult.multidigit ----
  template(
    '4.mult.multidigit.word',
    '4.mult.multidigit',
    2,
    'numeric',
    (rng) => {
      const a = int(rng, 12, 48);
      const b = int(rng, 3, 9);
      return {
        prompt: `A box holds ${a} pencils. How many pencils are in ${b} boxes?`,
        answer: String(a * b),
        params: { a, b },
      };
    },
    (p) => [`${num(p, 'b')} equal groups of ${num(p, 'a')} means multiply.`, `Try ${Math.floor(num(p, 'a') / 10) * 10} × ${num(p, 'b')} and ${num(p, 'a') % 10} × ${num(p, 'b')}, then add.`],
    (p, answer) => `${num(p, 'a')} × ${num(p, 'b')} = ${answer}.`,
    [addedInstead],
  ),
  template(
    '4.mult.multidigit.2x1',
    '4.mult.multidigit',
    3,
    'numeric',
    (rng) => {
      const a = int(rng, 12, 99);
      const b = int(rng, 3, 9);
      return { prompt: `${a} × ${b} = ?`, answer: String(a * b), params: { a, b } };
    },
    (p) => [
      `Split ${num(p, 'a')} into ${Math.floor(num(p, 'a') / 10) * 10} + ${num(p, 'a') % 10}.`,
      `Multiply each part by ${num(p, 'b')} and add the results.`,
    ],
    (p, answer) => {
      const a = num(p, 'a');
      const b = num(p, 'b');
      return `${Math.floor(a / 10) * 10} × ${b} = ${Math.floor(a / 10) * 10 * b} and ${a % 10} × ${b} = ${(a % 10) * b}. Together that is ${answer}.`;
    },
    [
      check('dropped_carry', 'Forgot to add the carried amount', 'Check the carry from the ones product into the tens.', (r, p) => {
        const a = num(p, 'a');
        const b = num(p, 'b');
        return (a % 10) * b >= 10 && numIs(r, Math.floor(a / 10) * b * 10 + ((a % 10) * b) % 10);
      }),
      addedInstead,
    ],
  ),
  template(
    '4.mult.multidigit.2x2',
    '4.mult.multidigit',
    4,
    'numeric',
    (rng) => {
      const a = int(rng, 12, 39);
      const b = int(rng, 1, 2) * 10 + int(rng, 1, 9);
      return { prompt: `${a} × ${b} = ?`, answer: String(a * b), params: { a, b } };
    },
    (p) => [
      `Multiply by the ones digit first: ${num(p, 'a')} × ${num(p, 'b') % 10}.`,
      `Then multiply by the tens digit: ${num(p, 'a')} × ${Math.floor(num(p, 'b') / 10) * 10}.`,
      'Add the two partial products.',
    ],
    (p, answer) => {
      const a = num(p, 'a');
      const b = num(p, 'b');
      return `${a} × ${b % 10} = ${a * (b % 10)} and ${a} × ${Math.floor(b / 10) * 10} = ${a * Math.floor(b / 10) * 10}. Sum: ${answer}.`;
    },
    [
      check('forgot_shift', 'Forgot the place value (zero) in the second row', 'The tens digit stands for tens, so its partial product needs a zero on the end.', (r, p) => {
        const a = num(p, 'a');
        const b = num(p, 'b');
        return numIs(r, a * (b % 10) + a * Math.floor(b / 10));
      }),
    ],
  ),
  template(
    '4.mult.multidigit.3x1',
    '4.mult.multidigit',
    5,
    'numeric',
    (rng) => {
      const a = int(rng, 112, 498);
      const b = int(rng, 3, 9);
      return { prompt: `${a} × ${b} = ?`, answer: String(a * b), params: { a, b } };
    },
    (p) => [
      `Split ${num(p, 'a')} into hundreds, tens and ones.`,
      `Multiply each part by ${num(p, 'b')}, then add.`,
    ],
    (p, answer) => `${num(p, 'a')} × ${num(p, 'b')} = ${answer}.`,
    [addedInstead],
  ),
];
