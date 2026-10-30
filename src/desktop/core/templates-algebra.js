'use strict';

const { formatPoly, polyEquals, parseExpression } = require('./expression');
const { makeChoices } = require('./helpers');

const near = (r, v) => typeof r === 'number' && Math.abs(r - v) < 1e-9;
const polyIs = (r, coeffs) => r && Array.isArray(r.poly) && polyEquals(r.poly, coeffs);
const str = (coeffs) => formatPoly(coeffs);

const EVAL_TEMPLATES = [
  {
    id: '6.expr.evaluate.linear',
    skill_id: '6.expr.evaluate',
    difficulty: 2,
    type: 'numeric',
    generate(rng) {
      const a = rng.int(2, 9);
      const b = rng.int(1, 9);
      const v = rng.int(2, 9);
      return { params: { a, b, v }, prompt: 'What is ' + str([b, a]) + ' when x = ' + v + '?', answer: a * v + b };
    },
    hint_steps: ({ a, v }) => ['Replace x with ' + v + '.', a + 'x means ' + a + ' × x, so work out ' + a + ' × ' + v + ' first.'],
    explanation: ({ a, b, v }) => 'Put x = ' + v + ' in: ' + a + ' × ' + v + ' + ' + b + ' = ' + (a * v + b) + '.',
    misconception_checks: [
      {
        id: 'concatenated',
        label: 'Wrote the number and the value side by side',
        message: 'In 3x the number and the letter are multiplied. 3x with x = 4 is 3 × 4 = 12, not 34.',
        test: (r, { params: { a, b, v } }) => near(r, Number('' + a + v) + b),
      },
    ],
  },
  {
    id: '6.expr.evaluate.brackets',
    skill_id: '6.expr.evaluate',
    difficulty: 3,
    type: 'numeric',
    generate(rng) {
      const a = rng.int(2, 6);
      const b = rng.int(1, 9);
      const v = rng.int(2, 9);
      return { params: { a, b, v }, prompt: 'What is ' + a + '(x + ' + b + ') when x = ' + v + '?', answer: a * (v + b) };
    },
    hint_steps: ({ b, v }) => ['Do the brackets first: x + ' + b + ' with x = ' + v + '.', 'Then multiply the result by the number outside.'],
    explanation: ({ a, b, v }) => a + '(' + v + ' + ' + b + ') = ' + a + ' × ' + (v + b) + ' = ' + a * (v + b) + '.',
    misconception_checks: [
      {
        id: 'multiplied-first-term-only',
        label: 'Multiplied only the first term in the brackets',
        message: 'The number outside multiplies everything inside the brackets, not just the first term.',
        test: (r, { params: { a, b, v } }) => near(r, a * v + b),
      },
    ],
  },
];

const SIMPLIFY_TEMPLATES = [
  {
    id: '6.expr.simplify.like',
    skill_id: '6.expr.simplify',
    difficulty: 2,
    type: 'expression',
    generate(rng) {
      const a = rng.int(2, 8);
      const b = rng.int(2, 8);
      const c = rng.int(1, 9);
      return { params: { a, b, c }, prompt: 'Simplify: ' + a + 'x + ' + b + 'x + ' + c, answer: str([c, a + b]) };
    },
    hint_steps: () => ['Only terms with the same letter can be combined.', 'Add the x terms together. The plain number stays as it is.'],
    explanation: ({ a, b, c }) => a + 'x + ' + b + 'x = ' + (a + b) + 'x, so the answer is ' + str([c, a + b]) + '.',
    misconception_checks: [
      {
        id: 'combined-unlike',
        label: 'Combined an x term with a plain number',
        message: 'x terms and plain numbers are different kinds of term and cannot be merged.',
        test: (r, { params: { a, b, c } }) => polyIs(r, [0, a + b + c]),
      },
    ],
  },
  {
    id: '6.expr.simplify.distribute',
    skill_id: '6.expr.simplify',
    difficulty: 3,
    type: 'expression',
    generate(rng) {
      const a = rng.int(2, 6);
      const b = rng.int(1, 6);
      const c = rng.int(1, 9);
      return { params: { a, b, c }, prompt: 'Simplify: ' + a + '(x + ' + b + ') + ' + c, answer: str([a * b + c, a]) };
    },
    hint_steps: ({ a }) => ['Multiply ' + a + ' by each term inside the brackets.', 'Then combine the plain numbers.'],
    explanation: ({ a, b, c }) => a + '(x + ' + b + ') = ' + a + 'x + ' + a * b + ', then add ' + c + ': ' + str([a * b + c, a]) + '.',
    misconception_checks: [
      {
        id: 'distributed-first-term-only',
        label: 'Multiplied only the first term in the brackets',
        message: 'The number outside multiplies every term inside the brackets.',
        test: (r, { params: { a, b, c } }) => polyIs(r, [b + c, a]),
      },
    ],
  },
  {
    id: '6.expr.simplify.subtract',
    skill_id: '6.expr.simplify',
    difficulty: 4,
    type: 'expression',
    generate(rng) {
      const c = rng.int(1, 5);
      const a = c + rng.int(1, 5);
      const d = rng.int(1, 6);
      const b = d + rng.int(1, 6);
      return { params: { a, b, c, d }, prompt: 'Simplify: ' + a + 'x + ' + b + ' - ' + c + 'x - ' + d, answer: str([b - d, a - c]) };
    },
    hint_steps: () => ['Group the x terms and the plain numbers separately.', 'Keep the minus sign with the term after it.'],
    explanation: ({ a, b, c, d }) => '(' + a + ' - ' + c + ')x + (' + b + ' - ' + d + ') = ' + str([b - d, a - c]) + '.',
    misconception_checks: [
      {
        id: 'sign-dropped',
        label: 'Added instead of subtracting a term',
        message: 'A minus sign belongs to the term right after it, so that term is taken away.',
        test: (r, { params: { a, b, c, d } }) => polyIs(r, [b + d, a + c]) || polyIs(r, [b - d, a + c]) || polyIs(r, [b + d, a - c]),
      },
    ],
  },
];

const ONESTEP_TEMPLATES = [
  {
    id: '7.eq.onestep.add',
    skill_id: '7.eq.onestep',
    difficulty: 1,
    type: 'numeric',
    generate(rng) {
      const v = rng.int(2, 20);
      const b = rng.int(2, 15);
      return { params: { v, b }, prompt: 'Solve: x + ' + b + ' = ' + (v + b), answer: v };
    },
    hint_steps: ({ b }) => ['Undo adding ' + b + ' by subtracting ' + b + ' from both sides.'],
    explanation: ({ v, b }) => 'Subtract ' + b + ' from both sides: x = ' + (v + b) + ' - ' + b + ' = ' + v + '.',
    misconception_checks: [
      {
        id: 'wrong-inverse',
        label: 'Used the wrong operation',
        message: 'To undo adding, subtract. You added instead.',
        test: (r, { params: { v, b } }) => near(r, v + 2 * b),
      },
    ],
  },
  {
    id: '7.eq.onestep.mult',
    skill_id: '7.eq.onestep',
    difficulty: 2,
    type: 'numeric',
    generate(rng) {
      const v = rng.int(2, 12);
      const a = rng.int(2, 9);
      return { params: { v, a }, prompt: 'Solve: ' + a + 'x = ' + a * v, answer: v };
    },
    hint_steps: ({ a }) => [a + 'x means ' + a + ' × x.', 'Undo multiplying by ' + a + ' by dividing both sides by ' + a + '.'],
    explanation: ({ v, a }) => 'Divide both sides by ' + a + ': x = ' + a * v + ' ÷ ' + a + ' = ' + v + '.',
    misconception_checks: [
      {
        id: 'wrong-inverse',
        label: 'Used the wrong operation',
        message: 'To undo multiplying, divide. You multiplied instead.',
        test: (r, { params: { v, a } }) => near(r, a * a * v),
      },
    ],
  },
  {
    id: '7.eq.onestep.mc',
    skill_id: '7.eq.onestep',
    difficulty: 2,
    type: 'multiple_choice',
    generate(rng) {
      const v = rng.int(5, 20);
      const b = rng.int(2, 9);
      return {
        params: { v, b },
        prompt: 'Which value of x solves x - ' + b + ' = ' + (v - b) + '?',
        choices: makeChoices(rng, v, [v - 2 * b, v - b, v + b + 1]),
        answer: String(v),
      };
    },
    hint_steps: ({ b }) => ['Undo subtracting ' + b + ' by adding ' + b + ' to both sides.'],
    explanation: ({ v, b }) => 'Add ' + b + ' to both sides: x = ' + (v - b) + ' + ' + b + ' = ' + v + '.',
    misconception_checks: [
      {
        id: 'wrong-inverse',
        label: 'Subtracted instead of adding',
        message: 'To undo subtracting, add.',
        test: (r, { params: { v, b } }) => r === String(v - 2 * b),
      },
    ],
  },
];

const TWOSTEP_TEMPLATES = [
  {
    id: '7.eq.twostep.basic',
    skill_id: '7.eq.twostep',
    difficulty: 3,
    type: 'numeric',
    generate(rng) {
      const v = rng.int(2, 12);
      const a = rng.int(2, 9);
      const b = rng.int(1, 12);
      return { params: { v, a, b }, prompt: 'Solve: ' + a + 'x + ' + b + ' = ' + (a * v + b), answer: v };
    },
    hint_steps: ({ b, a }) => ['First undo the + ' + b + ': subtract ' + b + ' from both sides.', 'Then undo the multiplying: divide both sides by ' + a + '.'],
    explanation: ({ v, a, b }) => 'Subtract ' + b + ': ' + a + 'x = ' + a * v + '. Divide by ' + a + ': x = ' + v + '.',
    misconception_checks: [
      {
        id: 'forgot-to-divide',
        label: 'Stopped after the first step',
        message: 'After subtracting you still have ' + 'a number times x. Divide to get x on its own.',
        test: (r, { params: { v, a } }) => near(r, a * v),
      },
      {
        id: 'added-instead-of-subtracting',
        label: 'Added instead of subtracting first',
        message: 'To undo + you subtract.',
        test: (r, { params: { v, a, b } }) => near(r, (a * v + 2 * b) / a),
      },
    ],
  },
  {
    id: '7.eq.twostep.minus',
    skill_id: '7.eq.twostep',
    difficulty: 4,
    type: 'numeric',
    generate(rng) {
      const v = rng.int(3, 12);
      const a = rng.int(2, 9);
      const b = rng.int(1, a * v - 1 > 12 ? 12 : a * v - 1);
      return { params: { v, a, b }, prompt: 'Solve: ' + a + 'x - ' + b + ' = ' + (a * v - b), answer: v };
    },
    hint_steps: ({ b }) => ['To undo - ' + b + ', add ' + b + ' to both sides.', 'Then divide by the number in front of x.'],
    explanation: ({ v, a, b }) => 'Add ' + b + ': ' + a + 'x = ' + a * v + '. Divide by ' + a + ': x = ' + v + '.',
    misconception_checks: [
      {
        id: 'sign-error',
        label: 'Subtracted when it should be added',
        message: 'The equation has - ' + 'a number, so undo it by adding that number to both sides.',
        test: (r, { params: { v, a, b } }) => near(r, (a * v - 2 * b) / a),
      },
    ],
  },
  {
    id: '7.eq.twostep.divide',
    skill_id: '7.eq.twostep',
    difficulty: 5,
    type: 'numeric',
    generate(rng) {
      const a = rng.int(2, 6);
      const k = rng.int(2, 9);
      const b = rng.int(1, 9);
      return { params: { a, k, b }, prompt: 'Solve: x/' + a + ' + ' + b + ' = ' + (k + b), answer: a * k };
    },
    hint_steps: ({ b, a }) => ['Subtract ' + b + ' from both sides first.', 'Then undo dividing by ' + a + ' by multiplying both sides by ' + a + '.'],
    explanation: ({ a, k, b }) => 'Subtract ' + b + ': x/' + a + ' = ' + k + '. Multiply by ' + a + ': x = ' + a * k + '.',
    misconception_checks: [
      {
        id: 'wrong-inverse',
        label: 'Divided instead of multiplying',
        message: 'x was divided by a number, so undo it by multiplying.',
        test: (r, { params: { a, k } }) => near(r, k / a),
      },
    ],
  },
];

module.exports = { ALGEBRA_TEMPLATES: [...EVAL_TEMPLATES, ...SIMPLIFY_TEMPLATES, ...ONESTEP_TEMPLATES, ...TWOSTEP_TEMPLATES], parseExpression };
