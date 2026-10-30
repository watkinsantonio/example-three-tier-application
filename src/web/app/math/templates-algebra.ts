import { int } from './rng.ts';
import { check, equivTo, num, numIs, template } from './template-helpers.ts';
import type { ProblemTemplate } from './types.ts';

export const ALGEBRA_TEMPLATES: ProblemTemplate[] = [
  // ---- 6.alg.evaluate ----
  template(
    '6.alg.evaluate.order',
    '6.alg.evaluate',
    2,
    'numeric',
    (rng) => {
      const a = int(rng, 2, 9);
      const b = int(rng, 2, 9);
      const c = int(rng, 2, 9);
      return { prompt: `${a} + ${b} × ${c} = ?`, answer: String(a + b * c), params: { a, b, c } };
    },
    (p) => ['Multiplication comes before addition.', `First work out ${num(p, 'b')} × ${num(p, 'c')}.`],
    (p, answer) => `${num(p, 'b')} × ${num(p, 'c')} = ${num(p, 'b') * num(p, 'c')}, then add ${num(p, 'a')} to get ${answer}.`,
    [
      check('left_to_right', 'Worked left to right, ignoring order of operations', 'Do multiplication before addition, even when the addition comes first.', (r, p) =>
        numIs(r, (num(p, 'a') + num(p, 'b')) * num(p, 'c')),
      ),
    ],
  ),
  template(
    '6.alg.evaluate.substitute',
    '6.alg.evaluate',
    3,
    'numeric',
    (rng) => {
      const m = int(rng, 2, 9);
      const k = int(rng, 1, 9);
      const x = int(rng, 2, 9);
      return { prompt: `Evaluate ${m}x + ${k} when x = ${x}.`, answer: String(m * x + k), params: { m, k, x } };
    },
    (p) => [`${num(p, 'm')}x means ${num(p, 'm')} × x.`, `Replace x with ${num(p, 'x')}: ${num(p, 'm')} × ${num(p, 'x')} + ${num(p, 'k')}.`],
    (p, answer) => `${num(p, 'm')} × ${num(p, 'x')} + ${num(p, 'k')} = ${answer}.`,
    [
      check('concatenated', 'Wrote the coefficient and value side by side', 'Next to a variable, a number means multiply, not "write side by side".', (r, p) =>
        numIs(r, Number(`${num(p, 'm')}${num(p, 'x')}`) + num(p, 'k')),
      ),
    ],
  ),
  template(
    '6.alg.evaluate.parens',
    '6.alg.evaluate',
    4,
    'numeric',
    (rng) => {
      const m = int(rng, 2, 6);
      const a = int(rng, 2, 9);
      const b = int(rng, 2, 9);
      const c = int(rng, 1, 9);
      return { prompt: `${m} × (${a} + ${b}) − ${c} = ?`, answer: String(m * (a + b) - c), params: { m, a, b, c } };
    },
    (p) => ['Work inside the parentheses first.', `${num(p, 'a')} + ${num(p, 'b')} = ${num(p, 'a') + num(p, 'b')}.`],
    (p, answer) => `${num(p, 'm')} × ${num(p, 'a') + num(p, 'b')} − ${num(p, 'c')} = ${answer}.`,
    [
      check('multiplied_first_term_only', 'Multiplied only the first number in the parentheses', 'The multiplier applies to everything inside the parentheses. Add them first.', (r, p) =>
        numIs(r, num(p, 'm') * num(p, 'a') + num(p, 'b') - num(p, 'c')),
      ),
    ],
  ),
  template(
    '6.alg.evaluate.square',
    '6.alg.evaluate',
    5,
    'numeric',
    (rng) => {
      const x = int(rng, 3, 9);
      return { prompt: `Evaluate x² − 2x + 3 when x = ${x}.`, answer: String(x * x - 2 * x + 3), params: { x } };
    },
    (p) => [`x² means x × x = ${num(p, 'x')} × ${num(p, 'x')}.`, 'Then subtract 2 × x and add 3.'],
    (p, answer) => `${num(p, 'x') * num(p, 'x')} − ${2 * num(p, 'x')} + 3 = ${answer}.`,
    [
      check('square_as_double', 'Treated x² as 2x', 'x² means x times itself, not x times 2.', (r) => numIs(r, 3)),
    ],
  ),

  // ---- 6.alg.onestep ----
  template(
    '6.alg.onestep.add',
    '6.alg.onestep',
    2,
    'numeric',
    (rng) => {
      const x = int(rng, 2, 15);
      const a = int(rng, 2, 12);
      return { prompt: `Solve: x + ${a} = ${x + a}`, answer: String(x), params: { a, b: x + a } };
    },
    (p) => [`Undo adding ${num(p, 'a')} by subtracting ${num(p, 'a')} from both sides.`],
    (p, answer) => `x = ${num(p, 'b')} − ${num(p, 'a')} = ${answer}.`,
    [
      check('wrong_inverse', 'Added instead of subtracting', 'To undo addition, subtract from both sides.', (r, p) =>
        numIs(r, num(p, 'a') + num(p, 'b')),
      ),
    ],
  ),
  template(
    '6.alg.onestep.sub',
    '6.alg.onestep',
    3,
    'numeric',
    (rng) => {
      const b = int(rng, 2, 15);
      const a = int(rng, 2, 12);
      return { prompt: `Solve: x − ${a} = ${b}`, answer: String(b + a), params: { a, b } };
    },
    (p) => [`Undo subtracting ${num(p, 'a')} by adding ${num(p, 'a')} to both sides.`],
    (p, answer) => `x = ${num(p, 'b')} + ${num(p, 'a')} = ${answer}.`,
    [
      check('wrong_inverse', 'Subtracted instead of adding', 'To undo subtraction, add to both sides.', (r, p) =>
        numIs(r, num(p, 'b') - num(p, 'a')),
      ),
    ],
  ),
  template(
    '6.alg.onestep.mult',
    '6.alg.onestep',
    3,
    'numeric',
    (rng) => {
      const a = int(rng, 2, 9);
      const x = int(rng, 2, 12);
      return { prompt: `Solve: ${a}x = ${a * x}`, answer: String(x), params: { a, b: a * x } };
    },
    (p) => [`${num(p, 'a')}x means ${num(p, 'a')} times x. Undo it by dividing both sides by ${num(p, 'a')}.`],
    (p, answer) => `x = ${num(p, 'b')} ÷ ${num(p, 'a')} = ${answer}.`,
    [
      check('multiplied_instead_of_divided', 'Multiplied instead of dividing', 'To undo multiplication, divide both sides.', (r, p) =>
        numIs(r, num(p, 'a') * num(p, 'b')),
      ),
    ],
  ),
  template(
    '6.alg.onestep.word',
    '6.alg.onestep',
    4,
    'numeric',
    (rng) => {
      const x = int(rng, 5, 20);
      const a = int(rng, 3, 12);
      return {
        prompt: `Sam has some stickers. After getting ${a} more he has ${x + a}. How many stickers did Sam start with?`,
        answer: String(x),
        params: { a, b: x + a },
      };
    },
    (p) => ['Let x be the number Sam started with, then write an equation: x + ' + num(p, 'a') + ' = ' + num(p, 'b') + '.'],
    (p, answer) => `x + ${num(p, 'a')} = ${num(p, 'b')}, so x = ${answer}.`,
    [
      check('wrong_inverse', 'Added the numbers in the story', 'He ended up with more than he started with, so the starting number is smaller.', (r, p) =>
        numIs(r, num(p, 'a') + num(p, 'b')),
      ),
    ],
  ),
  template(
    '6.alg.onestep.div',
    '6.alg.onestep',
    5,
    'numeric',
    (rng) => {
      const a = int(rng, 2, 9);
      const b = int(rng, 2, 12);
      return { prompt: `Solve: x ÷ ${a} = ${b}`, answer: String(a * b), params: { a, b } };
    },
    (p) => [`Undo dividing by ${num(p, 'a')} by multiplying both sides by ${num(p, 'a')}.`],
    (p, answer) => `x = ${num(p, 'b')} × ${num(p, 'a')} = ${answer}.`,
    [
      check('divided_instead_of_multiplied', 'Divided instead of multiplying', 'To undo division, multiply both sides.', (r, p) =>
        numIs(r, num(p, 'b') / num(p, 'a')),
      ),
    ],
  ),

  // ---- 7.alg.simplify ----
  template(
    '7.alg.simplify.like',
    '7.alg.simplify',
    2,
    'expression',
    (rng) => {
      const a = int(rng, 2, 9);
      const b = int(rng, 2, 9);
      return { prompt: `Simplify: ${a}x + ${b}x`, answer: `${a + b}x`, params: { a, b } };
    },
    () => ['Both terms have x, so they are like terms. Add their coefficients.'],
    (p, answer) => `${num(p, 'a')}x + ${num(p, 'b')}x = (${num(p, 'a')} + ${num(p, 'b')})x = ${answer}.`,
    [
      check('multiplied_coefficients', 'Multiplied the coefficients', 'When adding like terms, add the coefficients; do not multiply.', (r, p) =>
        num(p, 'a') + num(p, 'b') !== num(p, 'a') * num(p, 'b') && equivTo(r, `${num(p, 'a') * num(p, 'b')}x`),
      ),
    ],
  ),
  template(
    '7.alg.simplify.combine',
    '7.alg.simplify',
    3,
    'expression',
    (rng) => {
      const a = int(rng, 2, 9);
      const b = int(rng, 1, 9);
      const c = int(rng, 2, 9);
      const d = int(rng, 1, 9);
      return {
        prompt: `Simplify: ${a}x + ${b} + ${c}x + ${d}`,
        answer: `${a + c}x+${b + d}`,
        params: { a, b, c, d },
      };
    },
    () => ['Group the x terms together and the plain numbers together.'],
    (p, answer) => `(${num(p, 'a')}x + ${num(p, 'c')}x) + (${num(p, 'b')} + ${num(p, 'd')}) = ${answer}.`,
    [
      check('combined_unlike_terms', 'Combined x terms with plain numbers', 'x terms and plain numbers are not like terms, so they stay separate.', (r, p) =>
        equivTo(r, `${num(p, 'a') + num(p, 'b') + num(p, 'c') + num(p, 'd')}x`),
      ),
    ],
  ),
  template(
    '7.alg.simplify.distribute',
    '7.alg.simplify',
    4,
    'expression',
    (rng) => {
      const k = int(rng, 2, 6);
      const a = int(rng, 2, 6);
      const b = int(rng, 1, 9);
      return {
        prompt: `Expand and simplify: ${k}(${a}x + ${b})`,
        answer: `${k * a}x+${k * b}`,
        params: { k, a, b },
      };
    },
    (p) => [`Multiply ${num(p, 'k')} by each term inside the parentheses.`, `${num(p, 'k')} × ${num(p, 'a')}x and ${num(p, 'k')} × ${num(p, 'b')}.`],
    (p, answer) => `${num(p, 'k')}(${num(p, 'a')}x + ${num(p, 'b')}) = ${answer}.`,
    [
      check('distributed_to_first_only', 'Multiplied only the first term', 'The number outside multiplies every term inside the parentheses.', (r, p) =>
        equivTo(r, `${num(p, 'k') * num(p, 'a')}x+${num(p, 'b')}`),
      ),
    ],
  ),
  template(
    '7.alg.simplify.both',
    '7.alg.simplify',
    5,
    'expression',
    (rng) => {
      const k = int(rng, 2, 5);
      const a = int(rng, 2, 6);
      const b = int(rng, 1, 9);
      const m = int(rng, 2, 8);
      return {
        prompt: `Expand and simplify: ${k}(${a}x + ${b}) + ${m}x`,
        answer: `${k * a + m}x+${k * b}`,
        params: { k, a, b, m },
      };
    },
    (p) => [`Expand first: ${num(p, 'k')}(${num(p, 'a')}x + ${num(p, 'b')}).`, 'Then combine the x terms.'],
    (p, answer) => `${num(p, 'k') * num(p, 'a')}x + ${num(p, 'k') * num(p, 'b')} + ${num(p, 'm')}x = ${answer}.`,
    [
      check('distributed_to_first_only', 'Multiplied only the first term', 'The number outside multiplies every term inside the parentheses.', (r, p) =>
        equivTo(r, `${num(p, 'k') * num(p, 'a') + num(p, 'm')}x+${num(p, 'b')}`),
      ),
    ],
  ),

  // ---- 7.alg.twostep ----
  template(
    '7.alg.twostep.add',
    '7.alg.twostep',
    2,
    'numeric',
    (rng) => {
      const a = int(rng, 2, 6);
      const x = int(rng, 1, 9);
      const b = int(rng, 1, 9);
      return { prompt: `Solve: ${a}x + ${b} = ${a * x + b}`, answer: String(x), params: { a, b, c: a * x + b } };
    },
    (p) => [`First subtract ${num(p, 'b')} from both sides.`, `Then divide both sides by ${num(p, 'a')}.`],
    (p, answer) => `${num(p, 'a')}x = ${num(p, 'c') - num(p, 'b')}, so x = ${answer}.`,
    [
      check('skipped_constant', 'Divided without removing the constant first', 'Undo the addition first, then divide.', (r, p) =>
        numIs(r, num(p, 'c') / num(p, 'a')),
      ),
    ],
  ),
  template(
    '7.alg.twostep.sub',
    '7.alg.twostep',
    3,
    'numeric',
    (rng) => {
      const a = int(rng, 2, 6);
      const x = int(rng, 3, 9);
      const b = int(rng, 1, a * x - 1);
      return { prompt: `Solve: ${a}x − ${b} = ${a * x - b}`, answer: String(x), params: { a, b, c: a * x - b } };
    },
    (p) => [`First add ${num(p, 'b')} to both sides.`, `Then divide both sides by ${num(p, 'a')}.`],
    (p, answer) => `${num(p, 'a')}x = ${num(p, 'c') + num(p, 'b')}, so x = ${answer}.`,
    [
      check('wrong_sign_inverse', 'Subtracted when they should have added', 'To undo "− b", add b to both sides.', (r, p) =>
        numIs(r, (num(p, 'c') - num(p, 'b')) / num(p, 'a')),
      ),
    ],
  ),
  template(
    '7.alg.twostep.div',
    '7.alg.twostep',
    4,
    'numeric',
    (rng) => {
      const a = int(rng, 2, 6);
      const q = int(rng, 2, 9);
      const b = int(rng, 1, 9);
      return { prompt: `Solve: x ÷ ${a} + ${b} = ${q + b}`, answer: String(a * q), params: { a, b, c: q + b } };
    },
    (p) => [`First subtract ${num(p, 'b')} from both sides.`, `Then multiply both sides by ${num(p, 'a')}.`],
    (p, answer) => `x ÷ ${num(p, 'a')} = ${num(p, 'c') - num(p, 'b')}, so x = ${answer}.`,
    [
      check('forgot_last_step', 'Stopped after the first step', 'You still need to undo the division by multiplying.', (r, p) =>
        numIs(r, num(p, 'c') - num(p, 'b')),
      ),
    ],
  ),
  template(
    '7.alg.twostep.word',
    '7.alg.twostep',
    5,
    'numeric',
    (rng) => {
      const a = int(rng, 2, 6);
      const x = int(rng, 2, 12);
      const b = int(rng, 2, 9);
      return {
        prompt: `A taxi charges $${b} to start plus $${a} for each mile. A trip cost $${a * x + b}. How many miles was the trip?`,
        answer: String(x),
        params: { a, b, c: a * x + b },
      };
    },
    (p) => [`Write an equation: ${num(p, 'a')}m + ${num(p, 'b')} = ${num(p, 'c')}.`, 'Subtract the starting charge, then divide by the cost per mile.'],
    (p, answer) => `${num(p, 'a')}m = ${num(p, 'c') - num(p, 'b')}, so m = ${answer} miles.`,
    [
      check('skipped_constant', 'Ignored the starting charge', 'Take off the starting charge before dividing by the cost per mile.', (r, p) =>
        numIs(r, num(p, 'c') / num(p, 'a')),
      ),
    ],
  ),
];
