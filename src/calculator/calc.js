'use strict';

// Dependency-free expression evaluator. No I/O, no database, no network.
// Grammar (usual precedence, ^ is right-associative):
//   expr   := term (('+' | '-') term)*
//   term   := unary (('*' | '/' | '%') unary)*
//   unary  := ('-' | '+') unary | power
//   power  := atom ('^' unary)?
//   atom   := number | '(' expr ')'
//   number := digits ['.' digits] | '.' digits
// Accepts × ÷ − as aliases for * / -.

const MAX_LENGTH = 500;
const MAX_DEPTH = 100;

class CalcError extends Error {}

function tokenize(input) {
  const text = String(input)
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-');
  if (text.length > MAX_LENGTH) throw new CalcError('Expression too long');

  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if (/[0-9.]/.test(ch)) {
      const match = /^(?:\d+\.?\d*|\.\d+)/.exec(text.slice(i));
      if (!match) throw new CalcError(`Invalid number at position ${i + 1}`);
      tokens.push({ type: 'num', value: Number(match[0]) });
      i += match[0].length;
    } else if ('+-*/%^()'.includes(ch)) {
      tokens.push({ type: ch });
      i += 1;
    } else {
      throw new CalcError(`Unexpected character "${ch}"`);
    }
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  let depth = 0;
  const peek = () => (pos < tokens.length ? tokens[pos].type : 'end');

  function enter() {
    depth += 1;
    if (depth > MAX_DEPTH) throw new CalcError('Expression too deeply nested');
  }

  function expr() {
    enter();
    let value = term();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++].type;
      const right = term();
      value = op === '+' ? value + right : value - right;
    }
    depth -= 1;
    return value;
  }

  function term() {
    let value = unary();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = tokens[pos++].type;
      const right = unary();
      if (op === '*') value *= right;
      else if (right === 0) throw new CalcError('Division by zero');
      else value = op === '/' ? value / right : value % right;
    }
    return value;
  }

  function unary() {
    if (peek() === '-' || peek() === '+') {
      enter();
      const op = tokens[pos++].type;
      const value = unary();
      depth -= 1;
      return op === '-' ? -value : value;
    }
    return power();
  }

  function power() {
    const base = atom();
    if (peek() === '^') {
      pos += 1;
      return base ** unary();
    }
    return base;
  }

  function atom() {
    const tok = tokens[pos];
    if (!tok) throw new CalcError('Unexpected end of expression');
    if (tok.type === 'num') {
      pos += 1;
      return tok.value;
    }
    if (tok.type === '(') {
      pos += 1;
      const value = expr();
      if (peek() !== ')') throw new CalcError('Missing closing parenthesis');
      pos += 1;
      return value;
    }
    throw new CalcError(`Unexpected "${tok.type}"`);
  }

  if (tokens.length === 0) throw new CalcError('Empty expression');
  const value = expr();
  if (pos < tokens.length) throw new CalcError(`Unexpected "${tokens[pos].type}"`);
  return value;
}

/** Evaluate an expression to a number. Throws CalcError on bad input. */
function evaluate(input) {
  const result = parse(tokenize(input));
  if (!Number.isFinite(result)) throw new CalcError('Result is not a finite number');
  return result;
}

/** Round away binary floating-point noise (0.1 + 0.2 -> 0.3). */
function format(value) {
  const rounded = Number(value.toPrecision(15));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Evaluate and format; never throws. Returns { ok, text }. */
function calculate(input) {
  try {
    return { ok: true, text: format(evaluate(input)) };
  } catch (err) {
    if (err instanceof CalcError) return { ok: false, text: err.message };
    throw err;
  }
}

const api = { CalcError, evaluate, format, calculate };

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Calc = api;
