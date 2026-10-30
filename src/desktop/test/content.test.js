'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SKILLS, SKILL_PREREQS, allPrereqs } = require('../core/skills');
const { TEMPLATES, TYPES, buildProblem, publicProblem, templatesForSkill } = require('../core/problems');
const { normalizeResponse, gradeResponse } = require('../core/grading');

function correctResponse(p) {
  switch (p.type) {
    case 'fraction':
      return { n: p.answer.n, d: p.answer.d };
    default:
      return p.answer;
  }
}

test('skill graph: ids unique, prereqs exist and come earlier (no cycles)', () => {
  const seen = new Set();
  for (const s of SKILLS) {
    assert.ok(!seen.has(s.id), 'duplicate ' + s.id);
    for (const p of s.prereqs) assert.ok(seen.has(p), s.id + ' needs earlier prereq ' + p);
    seen.add(s.id);
    assert.ok(s.name && s.track && s.grade_band && s.description);
  }
  assert.equal(SKILL_PREREQS.length, SKILLS.reduce((n, s) => n + s.prereqs.length, 0));
  assert.ok(allPrereqs('7.eq.twostep').has('6.expr.evaluate'));
});

test('every skill has templates and every problem type is used', () => {
  for (const s of SKILLS) assert.ok(templatesForSkill(s.id).length >= 2, s.id + ' needs >= 2 templates');
  for (const t of TYPES) assert.ok(TEMPLATES.some((x) => x.type === t), 'no template of type ' + t);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) assert.ok(t.difficulty >= 1 && t.difficulty <= 5);
});

test('every template: deterministic, answerable, gradable, with hints and explanation (300 seeds each)', () => {
  for (const t of TEMPLATES) {
    for (let seed = 1; seed <= 300; seed++) {
      const p = buildProblem(t.id, seed);
      const again = buildProblem(t.id, seed);
      assert.deepEqual(p, again, t.id + ' is not deterministic');
      assert.ok(p.prompt && p.hints.length >= 1 && p.explanation, t.id);
      assert.ok(!/NaN|undefined|\[object/.test(p.prompt + p.explanation + p.hints.join(' ')), t.id + ' seed ' + seed + ' has bad text: ' + p.prompt + ' | ' + p.explanation);
      if (p.type === 'multiple_choice') {
        assert.equal(new Set(p.choices).size, p.choices.length, t.id + ' duplicate choices');
        assert.ok(p.choices.includes(p.answer), t.id + ' answer missing from choices');
      }
      if (p.type === 'drag') assert.deepEqual([...p.items].sort(), [...p.answer].sort());
      const norm = normalizeResponse(p.type, correctResponse(p), p);
      assert.equal(gradeResponse(p.type, norm, p).is_correct, true, t.id + ' seed ' + seed + ' correct answer rejected: ' + p.prompt);
      const pub = publicProblem(p);
      assert.ok(!('answer' in pub) && !('params' in pub), 'public problem leaks the answer');
    }
  }
});

test('answers are sane: no negative or zero-denominator results', () => {
  for (const t of TEMPLATES) {
    for (let seed = 1; seed <= 300; seed++) {
      const p = buildProblem(t.id, seed);
      if (p.type === 'numeric') assert.ok(Number.isInteger(p.answer) && p.answer > 0, t.id + ' ' + p.prompt + ' => ' + p.answer);
      if (p.type === 'fraction') assert.ok(p.answer.d > 0 && p.answer.n > 0);
    }
  }
});

test('misconception checks fire on the pattern they describe', () => {
  const p = buildProblem('5.frac.add.like.proper', 7);
  const { a, b, d } = p.params;
  const norm = normalizeResponse('fraction', { n: a + b, d: d * 2 }, p);
  assert.equal(gradeResponse('fraction', norm, p).is_correct, false);
  const { detectMisconception } = require('../core/problems');
  assert.equal(detectMisconception(p.template_id, norm, p).id, 'added-denominators');
});
