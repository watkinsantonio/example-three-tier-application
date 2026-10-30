'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');
const { evaluate, calculate, format, CalcError } = require('../calc.js');

test('basic arithmetic and precedence', () => {
  assert.equal(evaluate('2 + 3 * 4'), 14);
  assert.equal(evaluate('(2 + 3) * 4'), 20);
  assert.equal(evaluate('10 - 4 - 3'), 3);
  assert.equal(evaluate('100 / 5 / 2'), 10);
  assert.equal(evaluate('7 % 3'), 1);
});

test('power is right-associative and binds tighter than unary minus on its base', () => {
  assert.equal(evaluate('2 ^ 3 ^ 2'), 512);
  assert.equal(evaluate('-2 ^ 2'), -4);
  assert.equal(evaluate('2 ^ -1'), 0.5);
});

test('unary operators and decimals', () => {
  assert.equal(evaluate('-3 + 5'), 2);
  assert.equal(evaluate('--3'), 3);
  assert.equal(evaluate('3 * -2'), -6);
  assert.equal(evaluate('.5 + 1.5'), 2);
  assert.equal(evaluate('2.'), 2);
});

test('unicode operator aliases', () => {
  assert.equal(evaluate('6 × 7'), 42);
  assert.equal(evaluate('8 ÷ 2'), 4);
  assert.equal(evaluate('5 − 7'), -2);
});

test('floating-point noise is hidden', () => {
  assert.equal(calculate('0.1 + 0.2').text, '0.3');
  assert.equal(format(-0), '0');
  assert.equal(calculate('0 * -1').text, '0');
});

test('errors are reported, not thrown', () => {
  for (const bad of ['', '   ', '1 +', '(1 + 2', '1 + 2)', '2 $ 3', '1..2', '1 2', '*3', 'abc']) {
    const out = calculate(bad);
    assert.equal(out.ok, false, `expected "${bad}" to fail`);
    assert.ok(out.text.length > 0);
  }
  assert.deepEqual(calculate('1 / 0'), { ok: false, text: 'Division by zero' });
  assert.deepEqual(calculate('5 % 0'), { ok: false, text: 'Division by zero' });
  assert.equal(calculate('10 ^ 1000').ok, false);
  assert.throws(() => evaluate('1 +'), CalcError);
});

test('does not execute code and limits input size and depth', () => {
  assert.equal(calculate('process.exit(1)').ok, false);
  assert.equal(calculate('1+'.repeat(300) + '1').ok, false);
  assert.equal(calculate('('.repeat(200) + '1' + ')'.repeat(200)).ok, false);
  assert.equal(calculate('-'.repeat(200) + '1').ok, false);
  assert.equal(calculate('('.repeat(50) + '1' + ')'.repeat(50)).text, '1');
});

test('large and small results format sensibly', () => {
  assert.equal(calculate('2 ^ 40').text, '1099511627776');
  assert.equal(calculate('1 / 3').text, '0.333333333333333');
});

test('cli one-shot prints result or exits non-zero', () => {
  const cli = path.join(__dirname, '..', 'cli.js');
  assert.equal(execFileSync('node', [cli, '2', '+', '3', '*', '4']).toString(), '14\n');
  const bad = spawnSync('node', [cli, '1 / 0']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr.toString(), /Division by zero/);
});
