'use strict';

const { gcd } = require('./grading');

const fracStr = (n, d) => n + '/' + d;

function reduce(n, d) {
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

/** Build shuffled, de-duplicated multiple-choice options as strings. */
function makeChoices(rng, correct, wrongs, count = 4) {
  const out = [String(correct)];
  for (const w of wrongs) {
    const s = String(w);
    if (!out.includes(s)) out.push(s);
    if (out.length === count) break;
  }
  let pad = 1;
  while (out.length < count) {
    const s = String(Number(correct) + pad * 2);
    if (!out.includes(s)) out.push(s);
    pad++;
  }
  return rng.shuffle(out);
}

/** n distinct integers in [lo, hi]. */
function distinctInts(rng, count, lo, hi) {
  const set = new Set();
  while (set.size < count) set.add(rng.int(lo, hi));
  return [...set];
}

module.exports = { fracStr, reduce, makeChoices, distinctInts };
