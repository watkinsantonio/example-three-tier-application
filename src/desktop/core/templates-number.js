'use strict';

const { makeChoices, distinctInts } = require('./helpers');

const near = (r, v) => typeof r === 'number' && Math.abs(r - v) < 1e-9;
const reversed = {
  id: 'reversed-order',
  label: 'Ordered largest to smallest',
  message: 'That is the right set of numbers, but in the opposite order. Smallest goes first.',
  test: (r, { answer }) => Array.isArray(r) && r.join('|') === [...answer].reverse().join('|'),
};
const forgotCarry = (id, wrongFn) => ({
  id,
  label: 'Forgot to carry',
  message: 'It looks like a carried digit was left out. When the ones add to 10 or more, carry the tens to the next column.',
  test: (r, ctx) => wrongFn(ctx).some((w) => (typeof r === 'number' ? near(r, w) : r === String(w))),
});

function orderTemplate(id, difficulty, lo, hi, count, label) {
  return {
    id,
    skill_id: '2.num.order',
    difficulty,
    type: 'drag',
    generate(rng) {
      const nums = distinctInts(rng, count, lo, hi);
      const sorted = [...nums].sort((a, b) => a - b).map(String);
      let items = rng.shuffle(nums.map(String));
      if (items.join() === sorted.join()) items = items.reverse();
      return { params: { nums }, prompt: 'Put these ' + label + ' in order, smallest first.', items, answer: sorted };
    },
    hint_steps: () => ['Find the smallest number first.', 'Compare the digits from the left: more digits means a bigger number.', 'Then find the next smallest, and so on.'],
    explanation: (p, { answer }) => 'From smallest to largest: ' + answer.join(', ') + '.',
    misconception_checks: [reversed],
  };
}

function carryPair(rng, tensLo, tensHi, hundreds) {
  const oa = rng.int(5, 9);
  const ob = rng.int(10 - oa, 9);
  const lead = () => (hundreds ? rng.int(1, 4) * 100 : 0) + rng.int(tensLo, tensHi) * 10;
  return [lead() + oa, lead() + ob];
}

function addTemplate(id, difficulty, hundreds, mc) {
  return {
    id,
    skill_id: '3.add.regroup',
    difficulty,
    type: mc ? 'multiple_choice' : 'numeric',
    generate(rng) {
      const [a, b] = carryPair(rng, 1, 4, hundreds);
      const answer = a + b;
      const base = { params: { a, b }, prompt: a + ' + ' + b + ' = ?' };
      if (!mc) return { ...base, answer };
      return { ...base, answer: String(answer), choices: makeChoices(rng, answer, [answer - 10, answer + 10, answer - 1]) };
    },
    hint_steps: ({ a, b }) => ['Line the numbers up by place value.', 'Add the ones first: ' + (a % 10) + ' + ' + (b % 10) + ' = ' + ((a % 10) + (b % 10)) + '. That is 10 or more, so carry.', 'Add the tens (and the carried 1), then the hundreds.'],
    explanation: ({ a, b }) => a + ' + ' + b + ' = ' + (a + b) + '. The ones made more than 9, so one ten was carried.',
    misconception_checks: [forgotCarry('forgot-carry', ({ params: { a, b } }) => [a + b - 10, a + b - 100])],
  };
}

function multFactsTemplate(id, difficulty, lo, hi, mc) {
  return {
    id,
    skill_id: '3.mult.facts',
    difficulty,
    type: mc ? 'multiple_choice' : 'numeric',
    generate(rng) {
      const a = rng.int(lo, hi);
      const b = rng.int(lo, hi);
      const base = { params: { a, b }, prompt: a + ' × ' + b + ' = ?' };
      if (!mc) return { ...base, answer: a * b };
      return { ...base, answer: String(a * b), choices: makeChoices(rng, a * b, [a * b + a, a * b - b, a + b]) };
    },
    hint_steps: ({ a, b }) => ['Think of ' + a + ' groups of ' + b + '.', 'Try skip counting by ' + a + ': ' + [1, 2, 3].map((i) => a * i).join(', ') + '…', 'Or use a nearby fact you know and adjust.'],
    explanation: ({ a, b }) => a + ' × ' + b + ' = ' + a * b + '.',
    misconception_checks: [
      {
        id: 'added-instead',
        label: 'Added instead of multiplied',
        message: 'That is the sum. × means equal groups: add the number to itself that many times.',
        test: (r, { params: { a, b } }) => (typeof r === 'number' ? near(r, a + b) : r === String(a + b)),
      },
      {
        id: 'off-by-one-group',
        label: 'One group too many or too few',
        message: 'You were one group off. Recount how many groups there are.',
        test: (r, { params: { a, b } }) => [a * b + a, a * b - a, a * b + b, a * b - b].some((w) => (typeof r === 'number' ? near(r, w) : r === String(w))),
      },
    ],
  };
}

function divTemplate(id, difficulty, story) {
  return {
    id,
    skill_id: '3.div.facts',
    difficulty,
    type: 'numeric',
    generate(rng) {
      const a = rng.int(2, 9);
      const b = rng.int(2, difficulty > 2 ? 12 : 9);
      const prompt = story ? a * b + ' stickers are shared equally between ' + a + ' friends. How many does each friend get?' : a * b + ' ÷ ' + a + ' = ?';
      return { params: { a, b }, prompt, answer: b };
    },
    hint_steps: ({ a, b }) => ['Division is the opposite of multiplication.', 'Ask: ' + a + ' × ? = ' + a * b + '.'],
    explanation: ({ a, b }) => a * b + ' ÷ ' + a + ' = ' + b + ' because ' + a + ' × ' + b + ' = ' + a * b + '.',
    misconception_checks: [
      {
        id: 'multiplied-instead',
        label: 'Multiplied instead of divided',
        message: 'You multiplied. Dividing splits the total into equal groups, so the answer is smaller than the total.',
        test: (r, { params: { a, b } }) => near(r, a * a * b),
      },
    ],
  };
}

function multiDigitTemplate(id, difficulty, hundreds) {
  return {
    id,
    skill_id: '4.mult.multidigit',
    difficulty,
    type: 'numeric',
    generate(rng) {
      const o = rng.int(4, 9);
      const m = rng.int(3, 9);
      const rest = hundreds ? rng.int(1, 3) * 100 + rng.int(1, 9) * 10 : rng.int(1, 9) * 10;
      const a = rest + o;
      return { params: { a, m, o, rest }, prompt: a + ' × ' + m + ' = ?', answer: a * m };
    },
    hint_steps: ({ a, m, o }) => ['Split ' + a + ' into tens/hundreds and ones.', 'Multiply the ones: ' + o + ' × ' + m + ' = ' + o * m + '. Write the last digit and carry the rest.', 'Multiply the next place and add what you carried.'],
    explanation: ({ a, m }) => a + ' × ' + m + ' = ' + a * m + '.',
    misconception_checks: [
      {
        id: 'dropped-carry',
        label: 'Dropped the carry',
        message: 'The ones product was two digits. The tens digit has to be carried and added to the next column.',
        test: (r, { params: { a, m, o, rest } }) => near(r, rest * m + ((o * m) % 10)),
      },
    ],
  };
}

const NUMBER_TEMPLATES = [
  orderTemplate('2.num.order.2digit', 1, 10, 99, 4, '2-digit numbers'),
  orderTemplate('2.num.order.3digit', 2, 100, 999, 5, '3-digit numbers'),
  addTemplate('3.add.regroup.2digit', 2, false, false),
  addTemplate('3.add.regroup.3digit', 3, true, false),
  addTemplate('3.add.regroup.mc', 2, false, true),
  multFactsTemplate('3.mult.facts.small', 1, 2, 5, false),
  multFactsTemplate('3.mult.facts.mid', 2, 6, 9, false),
  multFactsTemplate('3.mult.facts.mc', 3, 6, 12, true),
  divTemplate('3.div.facts.basic', 2, false),
  divTemplate('3.div.facts.story', 3, true),
  multiDigitTemplate('4.mult.multidigit.2digit', 2, false),
  multiDigitTemplate('4.mult.multidigit.3digit', 4, true),
];

module.exports = { NUMBER_TEMPLATES };
