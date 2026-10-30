import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRating, parseDrinkName, parseScore, starsFor } from './logic.ts';

test('parseDrinkName trims and rejects blank or overlong names', () => {
  assert.deepEqual(parseDrinkName('  Negroni '), { value: 'Negroni' });
  assert.ok('error' in parseDrinkName('   '));
  assert.ok('error' in parseDrinkName(undefined));
  assert.ok('error' in parseDrinkName('x'.repeat(101)));
  assert.deepEqual(parseDrinkName('x'.repeat(100)), { value: 'x'.repeat(100) });
});

test('parseScore accepts whole numbers 1-5, including form strings', () => {
  assert.equal(parseScore('3'), 3);
  assert.equal(parseScore(5), 5);
  assert.equal(parseScore('1'), 1);
  assert.equal(parseScore('0'), null);
  assert.equal(parseScore('6'), null);
  assert.equal(parseScore('2.5'), null);
  assert.equal(parseScore(''), null);
  assert.equal(parseScore(null), null);
});

test('formatRating describes the average and count', () => {
  assert.equal(formatRating(null, 0), 'No ratings yet');
  assert.equal(formatRating(4.5, 1), '4.5 / 5 from 1 rating');
  assert.equal(formatRating(3, 2), '3.0 / 5 from 2 ratings');
});

test('starsFor rounds the average to whole stars', () => {
  assert.equal(starsFor(null), '☆☆☆☆☆');
  assert.equal(starsFor(3.4), '★★★☆☆');
  assert.equal(starsFor(3.6), '★★★★☆');
  assert.equal(starsFor(5), '★★★★★');
});
