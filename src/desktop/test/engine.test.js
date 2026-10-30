'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Engine } = require('../core/engine');
const { Store } = require('../core/store');
const { createApi, API_METHODS } = require('../core/api');
const { buildProblem } = require('../core/problems');
const { SKILLS } = require('../core/skills');

const T0 = Date.UTC(2025, 5, 1, 12);

function setup(opts = {}) {
  let seed = 1000;
  const clock = { t: T0 };
  const store = opts.store || new Store();
  const engine = new Engine({ store, now: () => clock.t, randomSeed: () => ++seed });
  return { engine, store, clock };
}
const answerOf = (pub) => {
  const p = buildProblem(pub.template_id, pub.seed);
  return p.type === 'fraction' ? { n: p.answer.n, d: p.answer.d } : p.answer;
};
const adult = (engine) => engine.createLearner({ display_name: 'Sam', birth_year: 1990 });
function practiceCorrect(engine, learner, skill_id, times) {
  let last;
  for (let i = 0; i < times; i++) {
    const { problem } = engine.nextProblem({ learner_id: learner.id, skill_id });
    last = engine.submitAnswer({ learner_id: learner.id, template_id: problem.template_id, seed: problem.seed, response: answerOf(problem) });
  }
  return last;
}

test('learner profiles: validation and the under-13 guardian rule', () => {
  const { engine } = setup();
  assert.throws(() => engine.createLearner({ display_name: '  ', birth_year: 1990 }), /name/);
  assert.throws(() => engine.createLearner({ display_name: 'A', birth_year: 'abc' }), /birth year/);
  assert.throws(() => engine.createLearner({ display_name: 'A', birth_year: 2030 }), /birth year/);
  assert.throws(() => engine.createLearner({ display_name: 'A'.repeat(41), birth_year: 1990 }), /too long/);

  // The clock says 2025 and only the birth year is known: born 2012 may still be 12, so a guardian is needed; born 2011 is at least 13.
  assert.throws(() => engine.createLearner({ display_name: 'Kit', birth_year: 2013 }), /guardian/);
  assert.throws(() => engine.createLearner({ display_name: 'Kit', birth_year: 2013, guardian_name: '  ' }), /guardian/);
  assert.equal(engine.listLearners().length, 0, 'failed validation creates nothing');
  assert.equal(Object.keys(engine.data.guardians).length, 0, 'no orphaned guardian');

  const kid = engine.createLearner({ display_name: 'Kit', birth_year: 2013, guardian_name: 'Pat' });
  assert.ok(kid.guardian_id && engine.data.guardians[kid.guardian_id].name === 'Pat');
  assert.equal(kid.age_band, '11-12');
  const teen = engine.createLearner({ display_name: 'Lee', birth_year: 2011 });
  assert.equal(teen.guardian_id, null);
  assert.equal(engine.listLearners().length, 2);
});

test('a failed save rolls back the change', () => {
  const store = new Store();
  const { engine } = setup({ store });
  store.save = () => { throw new Error('disk full'); };
  assert.throws(() => engine.createLearner({ display_name: 'Kit', birth_year: 2013, guardian_name: 'Pat' }), /disk full/);
  assert.equal(engine.listLearners().length, 0);
  assert.equal(Object.keys(engine.data.guardians).length, 0);
});

test('deleteLearner removes their data but not other learners', () => {
  const { engine } = setup();
  const a = adult(engine);
  const b = engine.createLearner({ display_name: 'Bo', birth_year: 1991 });
  practiceCorrect(engine, a, undefined, 2);
  practiceCorrect(engine, b, undefined, 1);
  engine.deleteLearner({ learner_id: a.id });
  assert.equal(engine.listLearners().length, 1);
  assert.ok(engine.data.attempts.every((x) => x.learner_id === b.id));
  assert.ok(Object.values(engine.data.mastery).every((m) => m.learner_id === b.id));
  assert.throws(() => engine.getProgress({ learner_id: a.id }), /not found/);
});

test('practice: first skill is the root, answers are never sent to the screen', () => {
  const { engine } = setup();
  const l = adult(engine);
  const next = engine.nextProblem({ learner_id: l.id });
  assert.equal(next.skill.id, '2.num.order');
  assert.equal(next.reason, 'learn');
  assert.deepEqual(Object.keys(next.problem).sort(), ['choices', 'difficulty', 'hints', 'items', 'prompt', 'seed', 'skill_id', 'template_id', 'type']);
  assert.throws(() => engine.nextProblem({ learner_id: l.id, skill_id: '3.mult.facts' }), /earlier skills/);
  assert.throws(() => engine.nextProblem({ learner_id: l.id, skill_id: 'nope' }), /Unknown skill/);
});

test('submitting: records an attempt, updates mastery, rejects repeats and bad input', () => {
  const { engine } = setup();
  const l = adult(engine);
  const { problem } = engine.nextProblem({ learner_id: l.id });
  assert.throws(() => engine.submitAnswer({ learner_id: l.id, template_id: problem.template_id, seed: problem.seed, response: [] }), /order/);
  assert.equal(engine.data.attempts.length, 0, 'invalid input is not an attempt');

  const res = engine.submitAnswer({ learner_id: l.id, template_id: problem.template_id, seed: problem.seed, response: answerOf(problem), time_ms: 4200, hints_used: 99 });
  assert.equal(res.is_correct, true);
  assert.ok(res.explanation && res.correct_answer);
  assert.ok(res.mastery.p_mastery > 0.1);
  const [attempt] = engine.data.attempts;
  assert.deepEqual(Object.keys(attempt).sort(), ['created_at', 'detected_misconception', 'hints_used', 'id', 'is_correct', 'learner_id', 'problem_instance', 'response', 'skill_id', 'template_id', 'time_ms']);
  assert.equal(attempt.time_ms, 4200);
  assert.equal(attempt.hints_used, problem.hints.length, 'hints_used is capped at the number of hints');
  assert.equal(attempt.problem_instance.seed, problem.seed);

  assert.throws(() => engine.submitAnswer({ learner_id: l.id, template_id: problem.template_id, seed: problem.seed, response: answerOf(problem) }), /already answered/);
  assert.equal(engine.data.attempts.length, 1);
  assert.throws(() => engine.submitAnswer({ learner_id: l.id, template_id: 'nope', seed: 1, response: 1 }), /Unknown/);
});

test('wrong answers detect misconceptions', () => {
  const { engine } = setup();
  const l = adult(engine);
  // Master prerequisites so the fraction skill unlocks, then provoke "added denominators".
  const needed = ['2.num.order', '3.add.regroup', '3.mult.facts', '3.div.facts', '4.frac.equiv'];
  for (const s of needed) assert.equal(practiceCorrect(engine, l, s, 12).mastery.status, 'mastered', s);
  const seed = 31;
  engine._issue(l.id, '5.frac.add.like.proper', seed);
  const p = buildProblem('5.frac.add.like.proper', seed);
  const res = engine.submitAnswer({ learner_id: l.id, template_id: p.template_id, seed, response: { n: p.params.a + p.params.b, d: p.params.d * 2 } });
  assert.equal(res.is_correct, false);
  assert.equal(res.misconception.id, 'added-denominators');
  assert.equal(engine.data.attempts.at(-1).detected_misconception, 'added-denominators');
  assert.equal(res.mastery.streak, 0);
  // "Right amount, wrong form"
  const seed2 = 32;
  engine._issue(l.id, '4.frac.equiv.simplify', seed2);
  const q = buildProblem('4.frac.equiv.simplify', seed2);
  const unsimplified = engine.submitAnswer({ learner_id: l.id, template_id: q.template_id, seed: seed2, response: { n: q.answer.n * q.params.k, d: q.answer.d * q.params.k } });
  assert.equal(unsimplified.is_correct, false);
  assert.equal(unsimplified.misconception.id, 'not-simplified');
});

test('skills unlock when their prerequisites are mastered', () => {
  const { engine } = setup();
  const l = adult(engine);
  const status = (id) => engine.getProgress({ learner_id: l.id }).skills.find((s) => s.skill_id === id).status;
  assert.equal(status('2.num.order'), 'learning');
  assert.equal(status('3.add.regroup'), 'locked');
  let unlocked = [];
  for (let i = 0; i < 12 && status('2.num.order') !== 'mastered'; i++) {
    const r = practiceCorrect(engine, l, '2.num.order', 1);
    if (r.newly_mastered) unlocked = r.unlocked_skills;
  }
  assert.equal(status('2.num.order'), 'mastered');
  assert.deepEqual(unlocked, ['Adding with regrouping']);
  assert.equal(status('3.add.regroup'), 'learning');
  assert.equal(status('3.mult.facts'), 'locked');
});

test('spaced review: a mastered skill comes back when it is due', () => {
  const { engine, clock } = setup();
  const l = adult(engine);
  practiceCorrect(engine, l, '2.num.order', 12);
  assert.equal(engine.nextProblem({ learner_id: l.id }).skill.id, '3.add.regroup');
  clock.t += 40 * 24 * 3600 * 1000;
  assert.equal(engine.getProgress({ learner_id: l.id }).skills[0].review_due, true);
  const next = engine.nextProblem({ learner_id: l.id });
  assert.equal(next.reason, 'review');
  assert.equal(next.skill.id, '2.num.order');
});

test('placement: a learner who knows everything is placed above everything', () => {
  const { engine } = setup();
  const l = adult(engine);
  const { placement_id } = engine.startPlacement({ learner_id: l.id });
  let steps = 0;
  for (;;) {
    const res = engine.nextPlacementProblem({ placement_id });
    if (res.finished) {
      assert.equal(res.result_skill_ids.length, SKILLS.length);
      break;
    }
    engine.submitPlacementAnswer({ placement_id, response: answerOf(res.problem) });
    assert.ok(++steps <= SKILLS.length);
  }
  assert.equal(steps, SKILLS.length);
  const progress = engine.getProgress({ learner_id: l.id });
  assert.equal(progress.mastered, SKILLS.length);
  assert.equal(engine.data.placements[placement_id].finished_at !== null, true);
  assert.throws(() => engine.submitPlacementAnswer({ placement_id, response: '1' }), /finished/);
});

test('placement: stops at the first gap and does not ask about skills behind it', () => {
  const { engine } = setup();
  const l = adult(engine);
  const { placement_id } = engine.startPlacement({ learner_id: l.id });
  const asked = [];
  let result;
  for (;;) {
    const res = engine.nextPlacementProblem({ placement_id });
    if (res.finished) {
      result = res.result_skill_ids;
      break;
    }
    asked.push(res.problem.skill_id);
    const know = ['2.num.order', '3.add.regroup'].includes(res.problem.skill_id);
    engine.submitPlacementAnswer({ placement_id, response: know ? answerOf(res.problem) : '987654' });
  }
  assert.deepEqual(result, ['2.num.order', '3.add.regroup']);
  assert.deepEqual(asked, ['2.num.order', '3.add.regroup', '3.mult.facts']);
  const prog = engine.getProgress({ learner_id: l.id });
  assert.equal(prog.mastered, 2);
  assert.equal(engine.nextProblem({ learner_id: l.id }).skill.id, '3.mult.facts');
});

test('placement is resumable: the same question is re-sent until it is answered', () => {
  const { engine } = setup();
  const l = adult(engine);
  const { placement_id } = engine.startPlacement({ learner_id: l.id });
  assert.equal(engine.startPlacement({ learner_id: l.id }).placement_id, placement_id, 'unfinished check is resumed');
  const a = engine.nextPlacementProblem({ placement_id });
  const b = engine.nextPlacementProblem({ placement_id });
  assert.deepEqual(a, b);
  assert.throws(() => engine.submitPlacementAnswer({ placement_id, response: ['x'] }), /order/);
  assert.deepEqual(engine.nextPlacementProblem({ placement_id }), a, 'invalid answer keeps the question pending');
  engine.submitPlacementAnswer({ placement_id, response: answerOf(a.problem) });
  assert.notDeepEqual(engine.nextPlacementProblem({ placement_id }).problem, a.problem);
  assert.equal(engine.data.attempts.length, 1);
});

test('persistence: data survives a restart; corrupt and newer files are handled', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mathpath-test-'));
  const file = path.join(dir, 'nested', 'data.json');
  const first = setup({ store: new Store(file) });
  const l = adult(first.engine);
  practiceCorrect(first.engine, l, undefined, 3);
  assert.ok(!fs.existsSync(file + '.tmp'), 'no temp file left behind');

  const second = setup({ store: new Store(file) });
  assert.equal(second.engine.listLearners()[0].display_name, 'Sam');
  assert.equal(second.engine.getProgress({ learner_id: l.id }).attempts, 3);

  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{not json');
  const recovered = new Store(bad);
  assert.ok(recovered.recoveredFrom && fs.existsSync(recovered.recoveredFrom), 'unreadable file is kept, not deleted');
  assert.deepEqual(recovered.data.learners, {});

  const newer = path.join(dir, 'newer.json');
  fs.writeFileSync(newer, JSON.stringify({ version: 99, learners: {}, attempts: [], mastery: {} }));
  assert.throws(() => new Store(newer), /newer version/);
  assert.ok(fs.existsSync(newer), 'the newer file is left in place');

  // A future file that renamed the keys we check must still be refused, not moved aside as "corrupt".
  const reshaped = path.join(dir, 'reshaped.json');
  fs.writeFileSync(reshaped, JSON.stringify({ version: 2, people: {}, history: [] }));
  assert.throws(() => new Store(reshaped), /newer version/);
  assert.ok(fs.existsSync(reshaped));
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.includes('corrupt')).length, 1, 'only the genuinely unreadable file was moved aside');
});

test('a wrong answer on a mastered skill does not re-lock the skills that depend on it', () => {
  const { engine, clock } = setup();
  const l = adult(engine);
  practiceCorrect(engine, l, '2.num.order', 12);
  practiceCorrect(engine, l, '3.add.regroup', 12);
  const status = (id) => engine.getProgress({ learner_id: l.id }).skills.find((s) => s.skill_id === id).status;
  assert.equal(status('3.mult.facts'), 'learning');
  practiceCorrect(engine, l, '3.mult.facts', 2); // started working on a dependent skill

  // Fail a review question on the prerequisite.
  clock.t += 40 * 24 * 3600 * 1000;
  const { problem } = engine.nextProblem({ learner_id: l.id, skill_id: '2.num.order' });
  const res = engine.submitAnswer({ learner_id: l.id, template_id: problem.template_id, seed: problem.seed, response: problem.type === 'drag' ? [...problem.items].sort().reverse() : '987654' });
  assert.equal(res.is_correct, false);
  assert.equal(res.mastery.status, 'mastered');
  assert.equal(res.newly_mastered, false);
  assert.equal(status('2.num.order'), 'mastered');
  assert.equal(status('3.add.regroup'), 'mastered');
  assert.equal(engine.getProgress({ learner_id: l.id }).skills[0].review_due, false, 'next review is a short while away, set by the clock');
  clock.t += 11 * 60 * 1000;
  assert.equal(engine.getProgress({ learner_id: l.id }).skills[0].review_due, true, 're-practice is scheduled instead');

  // Dependent skills stay open: can still ask and submit.
  const dep = engine.nextProblem({ learner_id: l.id, skill_id: '3.mult.facts' });
  assert.equal(engine.submitAnswer({ learner_id: l.id, template_id: dep.problem.template_id, seed: dep.problem.seed, response: answerOf(dep.problem) }).is_correct, true);
});

test('guardian rule is conservative about the unknown birth month', () => {
  const { engine } = setup(); // clock: 2025
  assert.throws(() => engine.createLearner({ display_name: 'Max', birth_year: 2012 }), /may be under 13/);
  assert.ok(engine.createLearner({ display_name: 'Max', birth_year: 2012, guardian_name: 'Pat' }).guardian_id);
  assert.equal(engine.createLearner({ display_name: 'Eli', birth_year: 2011 }).guardian_id, null);
});

test('only questions the app handed out can be submitted', () => {
  const { engine } = setup();
  const l = adult(engine);
  const made = buildProblem('2.num.order.2digit', 77);
  assert.throws(() => engine.submitAnswer({ learner_id: l.id, template_id: made.template_id, seed: 77, response: made.answer }), /not given to you/);
  assert.equal(engine.data.attempts.length, 0, 'a self-chosen seed earns nothing');
  const { problem } = engine.nextProblem({ learner_id: l.id });
  assert.throws(() => engine.submitAnswer({ learner_id: l.id, template_id: problem.template_id, seed: problem.seed + 1, response: answerOf(problem) }), /not given to you/);
  assert.equal(engine.submitAnswer({ learner_id: l.id, template_id: problem.template_id, seed: problem.seed, response: answerOf(problem) }).is_correct, true);
  for (let i = 0; i < 80; i++) engine.nextProblem({ learner_id: l.id });
  assert.ok(engine.issued.size <= 50, 'memory is bounded');
});

test('api exposes exactly the declared methods', () => {
  const { engine } = setup();
  const api = createApi(engine);
  assert.deepEqual(Object.keys(api).sort(), [...API_METHODS].sort());
  for (const name of API_METHODS) assert.equal(typeof engine[name], 'function', name);
  assert.ok(api.listSkills().length > 0);
  assert.equal(engine.listPrereqs().length > 0, true);
});
