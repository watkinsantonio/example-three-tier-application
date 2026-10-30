import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKILLS,
  SKILL_PREREQS,
  TEMPLATES,
  buildProblem,
  getTemplate,
  templatesForSkill,
  topologicalSkills,
} from './curriculum.ts';
import { detectMisconception, isCorrect } from './grading.ts';

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7919 + 1);
const BAD = /undefined|NaN|\[object|Infinity/;

test('skill ids and template ids are unique and templates point at real skills', () => {
  assert.equal(new Set(SKILLS.map((s) => s.id)).size, SKILLS.length);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) assert.ok(SKILLS.some((s) => s.id === t.skill_id), `${t.id} has an unknown skill`);
});

test('every skill has at least two templates and every template starts with its skill id', () => {
  for (const s of SKILLS) {
    assert.ok(templatesForSkill(s.id).length >= 2, `${s.id} needs at least 2 templates`);
  }
  for (const t of TEMPLATES) assert.ok(t.id.startsWith(t.skill_id + '.'), t.id);
});

test('prerequisites reference real skills and form an acyclic graph', () => {
  for (const p of SKILL_PREREQS) {
    assert.ok(SKILLS.some((s) => s.id === p.skill_id));
    assert.ok(SKILLS.some((s) => s.id === p.prereq_id));
  }
  const order = topologicalSkills().map((s) => s.id);
  assert.equal(order.length, SKILLS.length);
  for (const p of SKILL_PREREQS) assert.ok(order.indexOf(p.prereq_id) < order.indexOf(p.skill_id));
});

test('all five problem types are covered by the curriculum', () => {
  const types = new Set(TEMPLATES.map((t) => t.type));
  for (const type of ['numeric', 'multiple_choice', 'drag', 'fraction', 'expression']) assert.ok(types.has(type as never), type);
});

test('every template generates reproducible, well-formed problems whose stored answer grades as correct', () => {
  for (const t of TEMPLATES) {
    assert.ok(t.difficulty >= 1 && t.difficulty <= 5);
    for (const seed of SEEDS) {
      const p = buildProblem(t.id, seed);
      assert.deepEqual(buildProblem(t.id, seed), p, `${t.id} seed ${seed} is not deterministic`);
      assert.ok(p.prompt.length > 0 && !BAD.test(p.prompt), `${t.id}: bad prompt "${p.prompt}"`);
      assert.ok(!BAD.test(p.answer), `${t.id}: bad answer "${p.answer}"`);
      assert.ok(isCorrect(p, p.answer), `${t.id} seed ${seed}: answer "${p.answer}" is not graded correct`);
      const hints = t.hint_steps(p.params);
      assert.ok(hints.length >= 1 && hints.every((h) => h && !BAD.test(h)), `${t.id}: hints ${hints}`);
      const explanation = t.explanation(p.params, p.answer);
      assert.ok(explanation && !BAD.test(explanation), `${t.id}: explanation "${explanation}"`);
      if (t.type === 'multiple_choice') {
        assert.ok(p.choices && p.choices.length >= 2, t.id);
        assert.equal(new Set(p.choices).size, p.choices.length, `${t.id} has duplicate choices`);
        assert.ok(p.choices.includes(p.answer));
      }
      if (t.type === 'drag') {
        const parts = p.answer.split('|');
        assert.deepEqual([...(p.choices ?? [])].sort(), [...parts].sort());
        assert.notEqual((p.choices ?? []).join('|'), p.answer, `${t.id} starts already solved`);
      }
    }
  }
});

test('different seeds give a variety of problems', () => {
  for (const t of TEMPLATES) {
    const keys = new Set(SEEDS.map((s) => {
      const p = buildProblem(t.id, s);
      return `${p.prompt}#${p.answer}#${(p.choices ?? []).join(',')}`;
    }));
    assert.ok(keys.size >= 4, `${t.id} only produced ${keys.size} distinct problems`);
  }
});

test('buildProblem rejects unknown templates', () => {
  assert.throws(() => buildProblem('nope', 1), /Unknown template/);
});

test('misconception detectors never fire on the correct answer', () => {
  for (const t of TEMPLATES) {
    for (const seed of SEEDS) {
      const p = buildProblem(t.id, seed);
      const hit = detectMisconception(t.misconception_checks, p, p.answer);
      assert.equal(hit, null, `${t.id} seed ${seed}: "${hit?.id}" fires on the correct answer ${p.answer}`);
    }
  }
});

test('every misconception check can fire on some plausible wrong answer', () => {
  // For each check, search a few seeds and candidate wrong responses; it must fire for at least one.
  for (const t of TEMPLATES) {
    for (const check of t.misconception_checks) {
      let fired = false;
      for (const seed of SEEDS) {
        const p = buildProblem(t.id, seed);
        const candidates = new Set<string>();
        for (let v = -50; v <= 3000 && !fired; v++) candidates.add(String(v));
        for (const c of candidates) {
          if (check.detect(c, p.params)) {
            fired = true;
            break;
          }
        }
        if (fired) break;
        // Non-numeric types: try the strings the generator itself would offer.
        const others = [...(p.choices ?? []), '1/2', '3/4', 'x', '7x', '5x+2', ...(p.choices ? [[...p.choices].reverse().join('|'), [...p.answer.split('|')].reverse().join('|')] : [])];
        if (others.some((o) => check.detect(o, p.params))) {
          fired = true;
          break;
        }
        for (let k = 1; k <= 12 && !fired; k++) {
          for (let n = 1; n <= 40 && !fired; n++) if (check.detect(`${n}/${k}`, p.params)) fired = true;
        }
        if (fired) break;
        // Expression answers: try a handful of linear forms.
        for (let a = 1; a <= 60 && !fired; a++) {
          for (const b of [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 15, 18, 20, 24, 27, 30]) {
            if (check.detect(b ? `${a}x+${b}` : `${a}x`, p.params)) {
              fired = true;
              break;
            }
          }
        }
        if (fired) break;
      }
      assert.ok(fired, `${t.id}: misconception "${check.id}" can never fire`);
    }
  }
});

test('specific misconceptions are detected with feedback', () => {
  // 5/8 + 1/4 style: adding numerators and denominators
  const add = buildProblem('5.frac.add.unlike', 11);
  const { n1, d1, n2, d2 } = add.params as Record<string, number>;
  const wrong = detectMisconception(getTemplate('5.frac.add.unlike')!.misconception_checks, add, `${n1 + n2}/${d1 + d2}`);
  assert.equal(wrong?.id, 'added_denominators');
  assert.match(wrong!.feedback, /denominator/);

  const carry = buildProblem('2.addsub.100.carry', 3);
  const { a, b } = carry.params as Record<string, number>;
  assert.equal(
    detectMisconception(getTemplate('2.addsub.100.carry')!.misconception_checks, carry, String(a + b - 10))?.id,
    'forgot_carry',
  );

  const shift = buildProblem('4.mult.multidigit.2x2', 5);
  const { a: x, b: y } = shift.params as Record<string, number>;
  assert.equal(
    detectMisconception(getTemplate('4.mult.multidigit.2x2')!.misconception_checks, shift, String(x * (y % 10) + x * Math.floor(y / 10)))?.id,
    'forgot_shift',
  );

  const dist = buildProblem('7.alg.simplify.distribute', 9);
  const { k, a: ca, b: cb } = dist.params as Record<string, number>;
  assert.equal(
    detectMisconception(getTemplate('7.alg.simplify.distribute')!.misconception_checks, dist, `${k * ca}x+${cb}`)?.id,
    'distributed_to_first_only',
  );
});
