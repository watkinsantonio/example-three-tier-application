'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { COLUMNS, layout, applyKey } = require('../keypad.js');
const { calculate } = require('../calc.js');

const keys = layout.flat();
const labels = keys.map((k) => k.label);

test('every row fills exactly the grid columns', () => {
  for (const row of layout) {
    const cells = row.reduce((sum, k) => sum + (k.span || 1), 0);
    assert.equal(cells, COLUMNS, `row ${row.map((k) => k.label).join(' ')}`);
  }
});

test('keypad has digits, both parentheses, every operator, decimal point and equals', () => {
  for (const label of '0123456789()+−×÷%^.=⌫C') {
    assert.ok(labels.includes(label), `missing key ${label}`);
  }
  assert.equal(new Set(labels).size, labels.length, 'duplicate labels');
});

test('every key has a known kind', () => {
  for (const key of keys) {
    assert.ok(['key', 'op', 'clear', 'back', 'equals'].includes(key.kind), key.label);
  }
});

test('clicking keys can build a parenthesised expression that evaluates', () => {
  const press = (text, label) => applyKey(text, keys.find((k) => k.label === label));
  let text = '';
  for (const label of ['(', '2', '+', '3', ')', '×', '4']) text = press(text, label);
  assert.equal(text, '(2+3)×4');
  assert.equal(calculate(text).text, '20');
  assert.equal(press(text, '⌫'), '(2+3)×');
  assert.equal(press(text, 'C'), '');
});

test('index.html loads calc.js and keypad.js before ui.js', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const order = ['calc.js', 'keypad.js', 'ui.js'].map((f) => html.indexOf(`src="${f}"`));
  assert.ok(order.every((i) => i >= 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});
