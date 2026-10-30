'use strict';

// Parses polynomial expressions in one variable (x), e.g. "3x + 2(x - 1) + 4".
// Supports + - * / (constant divisor only), ^ (small whole exponents),
// parentheses and implicit multiplication. Result is a coefficient array.

const MAX_DEGREE = 6;
const EPS = 1e-9;

function trim(p) {
  const out = p.slice();
  while (out.length > 1 && Math.abs(out[out.length - 1]) < EPS) out.pop();
  return out;
}
function add(p, q, sign = 1) {
  const n = Math.max(p.length, q.length);
  const out = [];
  for (let i = 0; i < n; i++) out.push((p[i] || 0) + sign * (q[i] || 0));
  return trim(out);
}
function mul(p, q) {
  const out = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) out[i + j] += p[i] * q[j];
  if (out.length - 1 > MAX_DEGREE) throw new Error('Expression is too complicated');
  return trim(out);
}
function isConst(p) {
  return p.length === 1;
}

function tokenize(src) {
  const tokens = [];
  const s = String(src).replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const text = s.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) throw new Error('Bad number "' + text + '"');
      tokens.push({ t: 'num', v: Number(text) });
      i = j;
    } else if (c === 'x' || c === 'X') {
      tokens.push({ t: 'x' });
      i++;
    } else if ('+-*/^()'.includes(c)) {
      tokens.push({ t: c });
      i++;
    } else {
      throw new Error('Unexpected "' + c + '"');
    }
  }
  return tokens;
}

/**
 * @returns {{poly:number[], terms:number, hasParens:boolean}}
 * terms = number of top-level additive terms as written.
 */
function parseExpression(src) {
  if (typeof src !== 'string' || !src.trim()) throw new Error('Type an expression');
  const tokens = tokenize(src);
  let pos = 0;
  let hasParens = false;
  let topTerms = 0;
  const peek = () => (pos < tokens.length ? tokens[pos].t : null);

  function parseExpr(top) {
    let value = parseTerm();
    let count = 1;
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++].t;
      const rhs = parseTerm();
      value = add(value, rhs, op === '+' ? 1 : -1);
      count++;
    }
    if (top) topTerms = count;
    return value;
  }
  function startsFactor() {
    const t = peek();
    return t === 'num' || t === 'x' || t === '(';
  }
  function parseTerm() {
    let value = parseUnary();
    for (;;) {
      const t = peek();
      if (t === '*') {
        pos++;
        value = mul(value, parseUnary());
      } else if (t === '/') {
        pos++;
        const d = parseUnary();
        if (!isConst(d) || Math.abs(d[0]) < EPS) throw new Error('Can only divide by a non-zero number');
        value = value.map((c) => c / d[0]);
      } else if (startsFactor()) {
        value = mul(value, parsePower());
      } else {
        return value;
      }
    }
  }
  function parseUnary() {
    if (peek() === '-') {
      pos++;
      return parseUnary().map((c) => -c);
    }
    if (peek() === '+') {
      pos++;
      return parseUnary();
    }
    return parsePower();
  }
  function parsePower() {
    const base = parseAtom();
    if (peek() === '^') {
      pos++;
      if (peek() !== 'num') throw new Error('Exponent must be a whole number');
      const e = tokens[pos++].v;
      if (!Number.isInteger(e) || e < 0 || e > MAX_DEGREE) throw new Error('Exponent must be a whole number from 0 to ' + MAX_DEGREE);
      let out = [1];
      for (let i = 0; i < e; i++) out = mul(out, base);
      return out;
    }
    return base;
  }
  function parseAtom() {
    const t = tokens[pos];
    if (!t) throw new Error('The expression ends too early');
    if (t.t === 'num') {
      pos++;
      return [t.v];
    }
    if (t.t === 'x') {
      pos++;
      return [0, 1];
    }
    if (t.t === '(') {
      pos++;
      hasParens = true;
      const v = parseExpr(false);
      if (peek() !== ')') throw new Error('Missing )');
      pos++;
      return v;
    }
    throw new Error('Unexpected "' + t.t + '"');
  }

  const poly = parseExpr(true);
  if (pos < tokens.length) throw new Error('Unexpected "' + tokens[pos].t + '"');
  return { poly, terms: topTerms, hasParens };
}

function polyEquals(p, q) {
  const a = trim(p);
  const b = trim(q);
  if (a.length !== b.length) return false;
  return a.every((c, i) => Math.abs(c - b[i]) < 1e-7);
}

function nonZeroTerms(p) {
  const n = p.filter((c) => Math.abs(c) > EPS).length;
  return Math.max(n, 1);
}

function fmtNum(n) {
  return String(Math.round(n * 1e6) / 1e6);
}

/** Pretty-print a coefficient array, e.g. [4,5] -> "5x + 4". */
function formatPoly(p) {
  const parts = [];
  for (let d = p.length - 1; d >= 0; d--) {
    const c = p[d];
    if (Math.abs(c) < EPS && p.length > 1) continue;
    const abs = Math.abs(c);
    let body;
    if (d === 0) body = fmtNum(abs);
    else {
      const coef = abs === 1 ? '' : fmtNum(abs);
      body = coef + 'x' + (d > 1 ? '^' + d : '');
    }
    if (parts.length === 0) parts.push((c < 0 ? '-' : '') + body);
    else parts.push((c < 0 ? '- ' : '+ ') + body);
  }
  return parts.join(' ') || '0';
}

module.exports = { parseExpression, polyEquals, nonZeroTerms, formatPoly };
