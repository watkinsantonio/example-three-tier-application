'use strict';

const { UserError } = require('./errors');
const { parseExpression, polyEquals, nonZeroTerms, formatPoly } = require('./expression');

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Turn what the learner typed or picked into a normalised value, or throw a
 * UserError describing what to fix. Nothing is graded or recorded here.
 */
function normalizeResponse(type, response, problem) {
  switch (type) {
    case 'numeric': {
      const s = String(response == null ? '' : response).trim().replace(/,/g, '').replace(/−/g, '-');
      if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) throw new UserError('Enter a number, like 12 or 3.5.');
      return Number(s);
    }
    case 'multiple_choice': {
      if (typeof response !== 'string' || !problem.choices.includes(response)) throw new UserError('Pick one of the choices.');
      return response;
    }
    case 'fraction': {
      let n;
      let d;
      if (typeof response === 'string') {
        const m = response.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
        if (m) [n, d] = [Number(m[1]), Number(m[2])];
      } else if (response && typeof response === 'object') {
        const ok = (v) => /^-?\d+$/.test(String(v == null ? '' : v).trim());
        if (ok(response.n) && ok(response.d)) [n, d] = [Number(response.n), Number(response.d)];
      }
      if (n === undefined) throw new UserError('Fill in both the top and bottom of the fraction with whole numbers.');
      if (d === 0) throw new UserError('The bottom of a fraction cannot be 0.');
      if (d < 0) [n, d] = [-n, -d];
      return { n, d };
    }
    case 'expression': {
      try {
        const parsed = parseExpression(response);
        return { ...parsed, text: String(response).trim() };
      } catch (e) {
        throw new UserError("I couldn't read that expression: " + e.message + '. Try something like 5x + 4.');
      }
    }
    case 'drag': {
      const items = problem.items;
      if (!Array.isArray(response) || response.length !== items.length || [...response].sort().join('\u0000') !== [...items].sort().join('\u0000')) {
        throw new UserError('Put every item in order.');
      }
      return response.slice();
    }
    default:
      throw new Error('Unknown problem type: ' + type);
  }
}

/**
 * @returns {{is_correct:boolean, flags:string[]}} flags can include
 * "not-simplified" when the value is right but the form is not.
 */
function gradeResponse(type, normalized, problem) {
  const flags = [];
  switch (type) {
    case 'numeric':
      return { is_correct: Math.abs(normalized - problem.answer) < 1e-9, flags };
    case 'multiple_choice':
      return { is_correct: normalized === problem.answer, flags };
    case 'fraction': {
      const { n, d } = normalized;
      const a = problem.answer;
      if (problem.mode === 'exact') return { is_correct: n === a.n && d === a.d, flags };
      const sameValue = n * a.d === a.n * d;
      if (sameValue && (gcd(n, d) !== 1 && n !== 0)) {
        flags.push('not-simplified');
        return { is_correct: false, flags };
      }
      return { is_correct: sameValue, flags };
    }
    case 'expression': {
      const expected = parseExpression(problem.answer).poly;
      if (!polyEquals(normalized.poly, expected)) return { is_correct: false, flags };
      if (normalized.hasParens || normalized.terms > nonZeroTerms(normalized.poly)) {
        flags.push('not-simplified');
        return { is_correct: false, flags };
      }
      return { is_correct: true, flags };
    }
    case 'drag':
      return { is_correct: normalized.every((v, i) => v === problem.answer[i]), flags };
    default:
      throw new Error('Unknown problem type: ' + type);
  }
}

/** Human-readable correct answer. */
function answerText(type, problem) {
  switch (type) {
    case 'fraction':
      return problem.answer.d === 1 ? String(problem.answer.n) : problem.answer.n + '/' + problem.answer.d;
    case 'drag':
      return problem.answer.join(', then ');
    case 'expression':
      return formatPoly(parseExpression(problem.answer).poly);
    default:
      return String(problem.answer);
  }
}

module.exports = { normalizeResponse, gradeResponse, answerText, gcd };
