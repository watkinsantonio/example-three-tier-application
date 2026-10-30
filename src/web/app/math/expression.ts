// Tiny algebraic expression parser in one variable (x), used to check "expression" answers by equivalence.
// Supports + - * / ^ (small whole-number exponents), parentheses, decimals and implicit multiplication (2x, 3(x+1), (x+1)(x-1)).

type Node =
  | { t: 'num'; v: number }
  | { t: 'var' }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/'; a: Node; b: Node }
  | { t: 'pow'; a: Node; e: number };

type Token = { k: 'num'; v: number } | { k: 'x' } | { k: 'op'; v: string };

export const MAX_EXPRESSION_LENGTH = 80;
const MAX_EXPONENT = 6;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') {
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const text = src.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) throw new Error(`Bad number "${text}"`);
      tokens.push({ k: 'num', v: Number(text) });
      i = j;
    } else if (c === 'x' || c === 'X') {
      tokens.push({ k: 'x' });
      i++;
    } else if ('+-*/^()'.includes(c)) {
      tokens.push({ k: 'op', v: c });
      i++;
    } else if (c === '×' || c === '·') {
      tokens.push({ k: 'op', v: '*' });
      i++;
    } else if (c === '−') {
      tokens.push({ k: 'op', v: '-' });
      i++;
    } else {
      throw new Error(`Unexpected "${c}"`);
    }
  }
  return tokens;
}

function parseTokens(tokens: Token[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (t: Token | undefined, v: string) => t !== undefined && t.k === 'op' && t.v === v;

  function expr(): Node {
    let left = term();
    while (isOp(peek(), '+') || isOp(peek(), '-')) {
      const op = (tokens[pos++] as { v: '+' | '-' }).v;
      left = { t: 'bin', op, a: left, b: term() };
    }
    return left;
  }

  function startsFactor(t: Token | undefined) {
    return t !== undefined && (t.k === 'x' || isOp(t, '('));
  }

  function term(): Node {
    let left = unary();
    for (;;) {
      const t = peek();
      if (isOp(t, '*') || isOp(t, '/')) {
        pos++;
        left = { t: 'bin', op: (t as { v: '*' | '/' }).v, a: left, b: unary() };
      } else if (startsFactor(t)) {
        left = { t: 'bin', op: '*', a: left, b: power() }; // implicit multiplication
      } else {
        return left;
      }
    }
  }

  function unary(): Node {
    if (isOp(peek(), '-')) {
      pos++;
      return { t: 'neg', a: unary() };
    }
    if (isOp(peek(), '+')) {
      pos++;
      return unary();
    }
    return power();
  }

  function power(): Node {
    const base = atom();
    if (isOp(peek(), '^')) {
      pos++;
      let sign = 1;
      if (isOp(peek(), '-')) {
        pos++;
        sign = -1;
      }
      const t = peek();
      if (!t || t.k !== 'num' || !Number.isInteger(t.v) || t.v > MAX_EXPONENT) {
        throw new Error(`Exponents must be whole numbers up to ${MAX_EXPONENT}`);
      }
      pos++;
      return { t: 'pow', a: base, e: sign * t.v };
    }
    return base;
  }

  function atom(): Node {
    const t = tokens[pos++];
    if (!t) throw new Error('Expression ended early');
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'x') return { t: 'var' };
    if (t.v === '(') {
      const inner = expr();
      if (!isOp(tokens[pos], ')')) throw new Error('Missing )');
      pos++;
      return inner;
    }
    throw new Error(`Unexpected "${t.v}"`);
  }

  if (tokens.length === 0) throw new Error('Empty expression');
  const result = expr();
  if (pos !== tokens.length) throw new Error('Unexpected input');
  return result;
}

function evaluate(node: Node, x: number): number {
  switch (node.t) {
    case 'num':
      return node.v;
    case 'var':
      return x;
    case 'neg':
      return -evaluate(node.a, x);
    case 'pow':
      return Math.pow(evaluate(node.a, x), node.e);
    case 'bin': {
      const a = evaluate(node.a, x);
      const b = evaluate(node.b, x);
      if (node.op === '+') return a + b;
      if (node.op === '-') return a - b;
      if (node.op === '*') return a * b;
      return a / b;
    }
  }
}

/** Parse an expression; returns null if it is not valid. */
export function parseExpression(src: string): ((x: number) => number) | null {
  if (typeof src !== 'string' || src.length > MAX_EXPRESSION_LENGTH) return null;
  try {
    const ast = parseTokens(tokenize(src));
    return (x) => evaluate(ast, x);
  } catch {
    return null;
  }
}

const SAMPLE_POINTS = [-4, -3, -2, -1, 0, 1, 2, 3, 5, 7];

/** True when both expressions parse and agree (within rounding) at every sample point. */
export function expressionsEquivalent(a: string, b: string): boolean {
  const fa = parseExpression(a);
  const fb = parseExpression(b);
  if (!fa || !fb) return false;
  let compared = 0;
  for (const x of SAMPLE_POINTS) {
    const va = fa(x);
    const vb = fb(x);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    if (Math.abs(va - vb) > 1e-9 * Math.max(1, Math.abs(va), Math.abs(vb))) return false;
    compared++;
  }
  return compared >= 5;
}

/** Number of top-level terms as written, e.g. "5x+2" -> 2, "-x" -> 1, "2(x+1)" -> 1. */
export function termCount(src: string): number {
  const s = src.replace(/\s+/g, '');
  if (!s) return 0;
  let depth = 0;
  let count = 1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if ((c === '+' || c === '-') && depth === 0 && i > 0 && !'+-*/^('.includes(s[i - 1])) count++;
  }
  return count;
}

/** "Simplified" for our purposes: no parentheses and no more terms than the reference answer. */
export function isWrittenSimply(response: string, answer: string): boolean {
  return !/[()]/.test(response) && termCount(response) <= termCount(answer);
}
