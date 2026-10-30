'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseExpression, polyEquals, formatPoly } = require('../core/expression');
const { normalizeResponse, gradeResponse } = require('../core/grading');
const { UserError } = require('../core/errors');
const { newMastery, updateMastery, placeMastery, MASTERED_STREAK } = require('../core/mastery');

test('expression parser: implicit multiplication, brackets, subtraction, powers', () => {
  assert.deepEqual(parseExpression('3x + 2x + 4').poly, [4, 5]);
  assert.deepEqual(parseExpression('2(x + 3) - x').poly, [6, 1]);
  assert.deepEqual(parseExpression('(x+1)(x-1)').poly, [-1, 0, 1]);
  assert.deepEqual(parseExpression('x^2 + 2*x').poly, [0, 2, 1]);
  assert.deepEqual(parseExpression('−x + 3').poly, [3, -1]);
  assert.deepEqual(parseExpression('(2x + 4)/2').poly, [2, 1]);
  assert.equal(parseExpression('3x + 2x + 4').terms, 3);
  assert.equal(parseExpression('2(x+1)').hasParens, true);
});

test('expression parser rejects nonsense with a clear error', () => {
  for (const bad of ['', '3x +', '2 $ 3', '(x', 'x/x', 'x^y', '1..2']) assert.throws(() => parseExpression(bad), Error, bad);
  assert.throws(() => parseExpression('x^2^2^2^2^2^2^2'), Error);
});

test('formatPoly and polyEquals', () => {
  assert.equal(formatPoly([4, 5]), '5x + 4');
  assert.equal(formatPoly([-3, 2]), '2x - 3');
  assert.equal(formatPoly([0, -1]), '-x');
  assert.equal(formatPoly([0]), '0');
  assert.ok(polyEquals([1, 2, 0], [1, 2]));
});

test('numeric normalisation', () => {
  assert.equal(normalizeResponse('numeric', ' 1,200 ', {}), 1200);
  assert.equal(normalizeResponse('numeric', '-3.5', {}), -3.5);
  assert.throws(() => normalizeResponse('numeric', 'abc', {}), UserError);
  assert.throws(() => normalizeResponse('numeric', '', {}), UserError);
  assert.throws(() => normalizeResponse('numeric', '1/2', {}), UserError);
});

test('fraction grading: exact vs simplest, validation', () => {
  const simplest = { answer: { n: 1, d: 2 }, mode: 'simplest' };
  const grade = (resp, p) => gradeResponse('fraction', normalizeResponse('fraction', resp, p), p);
  assert.equal(grade({ n: 1, d: 2 }, simplest).is_correct, true);
  assert.equal(grade('1/2', simplest).is_correct, true);
  const un = grade({ n: 2, d: 4 }, simplest);
  assert.equal(un.is_correct, false);
  assert.deepEqual(un.flags, ['not-simplified']);
  const exact = { answer: { n: 4, d: 6 }, mode: 'exact' };
  assert.equal(grade({ n: 4, d: 6 }, exact).is_correct, true);
  assert.equal(grade({ n: 2, d: 3 }, exact).is_correct, false);
  assert.throws(() => normalizeResponse('fraction', { n: '1', d: '0' }, {}), /0/);
  assert.throws(() => normalizeResponse('fraction', { n: '', d: '2' }, {}), UserError);
  assert.throws(() => normalizeResponse('fraction', { n: '1.5', d: '2' }, {}), UserError);
  assert.deepEqual(normalizeResponse('fraction', { n: 1, d: -2 }, {}), { n: -1, d: 2 });
});

test('expression grading: equivalent but unsimplified is not accepted', () => {
  const p = { answer: '5x + 4' };
  const grade = (r) => gradeResponse('expression', normalizeResponse('expression', r, p), p);
  assert.equal(grade('5x+4').is_correct, true);
  assert.equal(grade('4 + 5x').is_correct, true);
  assert.equal(grade('5x + 5').is_correct, false);
  const un = grade('3x + 2x + 4');
  assert.equal(un.is_correct, false);
  assert.deepEqual(un.flags, ['not-simplified']);
  assert.equal(grade('(10x + 8)/2').is_correct, false);
  assert.throws(() => normalizeResponse('expression', '5x +', p), UserError);
});

test('multiple choice and drag validation', () => {
  const mc = { choices: ['1', '2'], answer: '2' };
  assert.throws(() => normalizeResponse('multiple_choice', undefined, mc), UserError);
  assert.throws(() => normalizeResponse('multiple_choice', '3', mc), UserError);
  assert.equal(gradeResponse('multiple_choice', '2', mc).is_correct, true);
  const dr = { items: ['3', '1', '2'], answer: ['1', '2', '3'] };
  assert.throws(() => normalizeResponse('drag', ['1', '2'], dr), UserError);
  assert.throws(() => normalizeResponse('drag', ['1', '1', '2'], dr), UserError);
  assert.equal(gradeResponse('drag', ['1', '2', '3'], dr).is_correct, true);
  assert.equal(gradeResponse('drag', ['3', '2', '1'], dr).is_correct, false);
});

test('mastery: correct answers raise it, wrong ones lower it, mastered needs a streak', () => {
  const t0 = Date.UTC(2025, 0, 1);
  let m = newMastery('L', 'S');
  const history = [m.p_mastery];
  for (let i = 0; i < 8; i++) {
    m = updateMastery(m, { is_correct: true }, t0);
    history.push(m.p_mastery);
  }
  for (let i = 1; i < 6; i++) assert.ok(history[i] > history[i - 1]);
  assert.equal(m.status, 'mastered');
  assert.ok(m.streak >= MASTERED_STREAK);
  const wrong = updateMastery(m, { is_correct: false }, t0);
  assert.ok(wrong.p_mastery < m.p_mastery);
  assert.equal(wrong.streak, 0);
  assert.equal(wrong.status, 'mastered', 'mastery is sticky: a slip does not demote the skill');
  assert.ok(Date.parse(wrong.next_review_at) - t0 < 60 * 60 * 1000, 'wrong answer is reviewed soon');
});

test('mastery: hints weaken the evidence and the review gap grows with the streak', () => {
  const t0 = Date.UTC(2025, 0, 1);
  const base = newMastery('L', 'S');
  const noHints = updateMastery(base, { is_correct: true, hints_used: 0 }, t0);
  const hints = updateMastery(base, { is_correct: true, hints_used: 3 }, t0);
  assert.ok(hints.p_mastery < noHints.p_mastery);
  let m = base;
  let last = 0;
  for (let i = 0; i < 6; i++) {
    m = updateMastery(m, { is_correct: true }, t0);
    const gap = Date.parse(m.next_review_at) - t0;
    assert.ok(gap >= last);
    last = gap;
  }
});

test('placeMastery marks a skill as mastered and schedules a review', () => {
  const m = placeMastery(newMastery('L', 'S'), Date.UTC(2025, 0, 1));
  assert.equal(m.status, 'mastered');
  assert.ok(m.p_mastery >= 0.95);
  assert.ok(m.next_review_at);
});
