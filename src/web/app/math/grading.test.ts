import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expressionsEquivalent,
  isWrittenSimply,
  parseExpression,
  termCount,
} from './expression.ts';
import { formatFraction, isCorrect, isUnsimplifiedEquivalent, parseFraction, parseNumber } from './grading.ts';
import { createRng, hashSeed, int, shuffle } from './rng.ts';

test('createRng is deterministic and stays in [0, 1)', () => {
  const a = createRng(42);
  const b = createRng(42);
  const seq = Array.from({ length: 20 }, () => a());
  assert.deepEqual(seq, Array.from({ length: 20 }, () => b()));
  assert.ok(seq.every((v) => v >= 0 && v < 1));
  assert.notDeepEqual(seq, Array.from({ length: 20 }, createRng(43)));
});

test('int is inclusive on both ends and shuffle keeps every item', () => {
  const rng = createRng(1);
  const seen = new Set(Array.from({ length: 300 }, () => int(rng, 3, 5)));
  assert.deepEqual([...seen].sort(), [3, 4, 5]);
  assert.deepEqual([...shuffle(rng, [1, 2, 3, 4, 5])].sort(), [1, 2, 3, 4, 5]);
  assert.equal(hashSeed('a:b'), hashSeed('a:b'));
  assert.notEqual(hashSeed('a:b'), hashSeed('a:c'));
});

test('parseNumber accepts plain numbers and thousands commas but not junk', () => {
  assert.equal(parseNumber(' 42 '), 42);
  assert.equal(parseNumber('-3.5'), -3.5);
  assert.equal(parseNumber('1,200'), 1200);
  assert.equal(parseNumber('.5'), 0.5);
  for (const bad of ['', 'abc', '12abc', '1/2', '--3', '1.2.3', '1,2']) assert.equal(parseNumber(bad), null, bad);
});

test('parseFraction handles fractions, whole numbers and rejects zero denominators', () => {
  assert.deepEqual(parseFraction('3/4'), { n: 3, d: 4 });
  assert.deepEqual(parseFraction(' 6 / 8 '), { n: 6, d: 8 });
  assert.deepEqual(parseFraction('5'), { n: 5, d: 1 });
  assert.deepEqual(parseFraction('1/-2'), { n: -1, d: 2 });
  for (const bad of ['1/0', '1.5', 'a/b', '1/2/3', '']) assert.equal(parseFraction(bad), null, bad);
  assert.equal(formatFraction({ n: 6, d: 8 }), '3/4');
  assert.equal(formatFraction({ n: 8, d: 4 }), '2');
});

test('numeric grading', () => {
  const p = { type: 'numeric' as const, answer: '56' };
  assert.ok(isCorrect(p, '56'));
  assert.ok(isCorrect(p, ' 56.0 '));
  assert.ok(!isCorrect(p, '55'));
  assert.ok(!isCorrect(p, 'fifty six'));
  assert.ok(isCorrect({ type: 'numeric', answer: '1200' }, '1,200'));
});

test('multiple choice and drag grading are exact', () => {
  assert.ok(isCorrect({ type: 'multiple_choice', answer: '3/8' }, '3/8'));
  assert.ok(!isCorrect({ type: 'multiple_choice', answer: '3/8' }, '6/16'));
  assert.ok(isCorrect({ type: 'drag', answer: '1/4|1/3|1/2' }, '1/4|1/3|1/2'));
  assert.ok(!isCorrect({ type: 'drag', answer: '1/4|1/3|1/2' }, '1/3|1/4|1/2'));
});

test('fraction grading requires the simplest form', () => {
  const p = { type: 'fraction' as const, answer: '3/4' };
  assert.ok(isCorrect(p, '3/4'));
  assert.ok(isCorrect(p, ' 3 / 4 '));
  assert.ok(!isCorrect(p, '6/8'));
  assert.ok(!isCorrect(p, '0.75'));
  assert.ok(!isCorrect(p, '3/0'));
  assert.ok(isCorrect({ type: 'fraction', answer: '2' }, '2'));
  assert.ok(isCorrect({ type: 'fraction', answer: '2' }, '2/1'));
  assert.ok(isUnsimplifiedEquivalent('fraction', '6/8', '3/4'));
  assert.ok(!isUnsimplifiedEquivalent('fraction', '3/4', '3/4'));
  assert.ok(!isUnsimplifiedEquivalent('fraction', '5/8', '3/4'));
});

test('expression parser evaluates operators, precedence, powers and implicit multiplication', () => {
  const f = (src: string, x: number) => parseExpression(src)!(x);
  assert.equal(f('2x+3', 4), 11);
  assert.equal(f('3(x+1)', 2), 9);
  assert.equal(f('(x+1)(x-1)', 3), 8);
  assert.equal(f('-x^2', 3), -9);
  assert.equal(f('2x^2', 3), 18);
  assert.equal(f('x/2+1', 6), 4);
  assert.equal(f('2 * x - 1', 5), 9);
  assert.equal(f('1.5x', 2), 3);
});

test('expression parser rejects malformed or unsafe input', () => {
  for (const bad of ['', '2x+', '(x', 'x)', '2 3', 'x3', 'y+1', '2x^x', 'x^9', 'x^1.5', '1..2', 'alert(1)', '2x+' + '1+'.repeat(60)]) {
    assert.equal(parseExpression(bad), null, bad);
  }
  assert.ok(!expressionsEquivalent('2x+', '2x'));
});

test('expression equivalence compares values, not spelling', () => {
  assert.ok(expressionsEquivalent('7x', 'x*7'));
  assert.ok(expressionsEquivalent('2(x+3)', '2x+6'));
  assert.ok(expressionsEquivalent('6+2x', '2x+6'));
  assert.ok(!expressionsEquivalent('7x', '7x+1'));
  assert.ok(!expressionsEquivalent('7x', '12x'));
  assert.ok(!expressionsEquivalent('x/0', 'x/0'), 'undefined expressions are never accepted');
});

test('termCount and isWrittenSimply', () => {
  assert.equal(termCount('5x+2'), 2);
  assert.equal(termCount('-x'), 1);
  assert.equal(termCount('2(x+1)'), 1);
  assert.equal(termCount('2x - 3x + 4'), 3);
  assert.equal(termCount('2x*-3'), 1);
  assert.ok(isWrittenSimply('6+2x', '2x+6'));
  assert.ok(!isWrittenSimply('2x+3x', '5x'));
  assert.ok(!isWrittenSimply('2(x+3)', '2x+6'));
});

test('expression grading needs an equivalent AND simplified answer', () => {
  const p = { type: 'expression' as const, answer: '5x+3' };
  assert.ok(isCorrect(p, '5x+3'));
  assert.ok(isCorrect(p, '3 + 5x'));
  assert.ok(!isCorrect(p, '2x+3x+3'));
  assert.ok(!isCorrect(p, '5x+4'));
  assert.ok(!isCorrect(p, '5x+'));
  assert.ok(isUnsimplifiedEquivalent('expression', '2x+3x+3', '5x+3'));
  assert.ok(!isUnsimplifiedEquivalent('expression', '5x+4', '5x+3'));
});

test('isCorrect never throws on odd input', () => {
  for (const type of ['numeric', 'multiple_choice', 'drag', 'fraction', 'expression'] as const) {
    assert.equal(isCorrect({ type, answer: '1' }, '\u0000'), false);
    assert.equal(isCorrect({ type, answer: '1' }, undefined as unknown as string), false);
    assert.equal(isCorrect({ type, answer: '1' }, 'x'.repeat(100000)), false);
  }
});
