import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, buildProblem, topologicalSkills } from './curriculum.ts';
import {
  activePlacement,
  answerPlacement,
  createLearner,
  deleteLearner,
  emptyState,
  getMastery,
  needsGuardian,
  nextActivity,
  placementNext,
  skillProgress,
  startPlacement,
  statusOf,
  submitAttempt,
} from './engine.ts';
import { MASTERY_STREAK, applyAttempt, newMastery, reviewDays } from './mastery.ts';
import { BACKUP_KEY, STORAGE_KEY, loadState, parseStored, saveState } from './storage.ts';
import type { MathState } from './types.ts';

const NOW = new Date('2026-03-01T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function withLearner(birthYear = 2000): { state: MathState; id: string } {
  const r = createLearner(emptyState(), { display_name: 'Sam', birth_year: birthYear, guardian_name: 'Pat' }, { learner: 'L1', guardian: 'G1' }, NOW);
  assert.ok('state' in r);
  return { state: r.state, id: 'L1' };
}

let counter = 0;
/** Answer the given problem correctly (or wrongly) and return the new state. */
function answer(state: MathState, learner: string, templateId: string, seed: number, ok: boolean, hints = 0, now = NOW) {
  const problem = buildProblem(templateId, seed);
  const response = ok ? problem.answer : 'not an answer';
  const r = submitAttempt(state, learner, { template_id: templateId, seed, response, time_ms: 1000, hints_used: hints }, `A${++counter}`, now);
  assert.ok('state' in r, JSON.stringify(r));
  return r;
}

/** Master a skill with correct answers. */
function master(state: MathState, learner: string, skillId: string, now = NOW): MathState {
  let s = state;
  for (let i = 0; i < 10 && statusOf(s, learner, skillId) !== 'mastered'; i++) {
    const a = nextActivity(s, learner, now, 100 + i, skillId);
    assert.ok(a);
    s = answer(s, learner, a.template_id, a.seed, true, 0, now).state;
  }
  assert.equal(statusOf(s, learner, skillId), 'mastered');
  return s;
}

test('needsGuardian is true for learners 13 or younger by birth year', () => {
  assert.ok(needsGuardian(2026, NOW));
  assert.ok(needsGuardian(2013, NOW));
  assert.ok(!needsGuardian(2012, NOW));
});

test('createLearner stores a guardian only when one is required', () => {
  const kid = createLearner(emptyState(), { display_name: ' Kit ', birth_year: 2018, guardian_name: ' Pat ' }, { learner: 'L', guardian: 'G' }, NOW);
  assert.ok('state' in kid);
  assert.equal(kid.learner.display_name, 'Kit');
  assert.equal(kid.learner.guardian_id, 'G');
  assert.deepEqual(kid.state.guardians, [{ id: 'G', name: 'Pat' }]);

  const adult = createLearner(emptyState(), { display_name: 'Ana', birth_year: 1990 }, { learner: 'L', guardian: 'G' }, NOW);
  assert.ok('state' in adult);
  assert.equal(adult.learner.guardian_id, null);
  assert.deepEqual(adult.state.guardians, []);
});

test('createLearner validates its input and does not change state on error', () => {
  const base = emptyState();
  const ids = { learner: 'L', guardian: 'G' };
  const err = (input: Parameters<typeof createLearner>[1]) => {
    const r = createLearner(base, input, ids, NOW);
    assert.ok('error' in r);
    return r.error;
  };
  assert.match(err({ display_name: '  ', birth_year: 1990 }), /name/);
  assert.match(err({ display_name: 'x'.repeat(41), birth_year: 1990 }), /40/);
  assert.match(err({ display_name: 'Kit', birth_year: 2018 }), /guardian/i);
  assert.match(err({ display_name: 'Kit', birth_year: 2018, guardian_name: '  ' }), /guardian/i);
  assert.match(err({ display_name: 'Kit', birth_year: 1800 }), /birth year/);
  assert.match(err({ display_name: 'Kit', birth_year: 2030 }), /birth year/);
  assert.match(err({ display_name: 'Kit', birth_year: 1990.5 }), /birth year/);
  assert.deepEqual(base, emptyState());

  const { state } = withLearner();
  const dup = createLearner(state, { display_name: 'sam', birth_year: 1990 }, ids, NOW);
  assert.ok('error' in dup);
});

test('deleteLearner removes the learner, their data and an unused guardian', () => {
  const a = withLearner(2018);
  const first = nextActivity(a.state, a.id, NOW, 5)!;
  const s1 = answer(a.state, a.id, first.template_id, first.seed, true).state;
  const withPlacement = startPlacement(s1, a.id, 'P1', NOW);
  assert.ok('state' in withPlacement);
  const cleaned = deleteLearner(withPlacement.state, a.id);
  assert.deepEqual(cleaned, emptyState());
});

test('a new learner can only practise root skills; the rest are locked', () => {
  const { state, id } = withLearner();
  const progress = skillProgress(state, id, NOW);
  assert.equal(progress.length, SKILLS.length);
  const roots = progress.filter((p) => p.mastery.status === 'learning').map((p) => p.skill.id).sort();
  assert.deepEqual(roots, ['2.addsub.100', '3.frac.intro', '3.mult.facts']);
  assert.ok(progress.filter((p) => p.mastery.status === 'locked').length === SKILLS.length - 3);
  assert.equal(nextActivity(state, id, NOW, 1, '3.div.facts'), null);
  const locked = submitAttempt(state, id, { template_id: '3.div.facts.basic', seed: 1, response: '3', time_ms: 1, hints_used: 0 }, 'A', NOW);
  assert.ok('error' in locked);
});

test('three clean correct answers in a row master a numeric skill and unlock its dependents', () => {
  const { state, id } = withLearner();
  let s = state;
  assert.equal(statusOf(s, id, '3.div.facts'), 'locked');
  let newly = false;
  for (let i = 0; i < MASTERY_STREAK; i++) {
    const a = nextActivity(s, id, NOW, 10 + i, '3.mult.facts')!;
    const r = answer(s, id, a.template_id, a.seed, true);
    s = r.state;
    newly = r.result.newly_mastered;
  }
  assert.ok(newly || getMastery(s, id, '3.mult.facts').status === 'mastered');
  const m = getMastery(s, id, '3.mult.facts');
  assert.equal(m.status, 'mastered');
  assert.ok(m.p_mastery >= 0.95 && m.streak >= 3);
  assert.equal(statusOf(s, id, '3.div.facts'), 'learning');
  assert.equal(statusOf(s, id, '4.mult.multidigit'), 'locked', 'multidigit also needs 2.addsub.100');
  assert.equal(s.attempts.length, 3);
});

test('mastery needs a streak: right, wrong, right does not master', () => {
  const { state, id } = withLearner();
  let s = state;
  for (const ok of [true, true, false, true, true]) {
    s = answer(s, id, '3.mult.facts.easy', 4 + s.attempts.length, ok).state;
  }
  const m = getMastery(s, id, '3.mult.facts');
  assert.equal(m.streak, 2);
  assert.notEqual(m.status, 'mastered');
});

test('correct answers after hints are not full evidence and do not extend the streak', () => {
  const { state, id } = withLearner();
  const a = answer(state, id, '3.mult.facts.easy', 1, true, 0).state;
  const before = getMastery(a, id, '3.mult.facts');
  const b = answer(a, id, '3.mult.facts.easy', 2, true, 2);
  const after = getMastery(b.state, id, '3.mult.facts');
  assert.equal(after.streak, before.streak);
  assert.ok(after.p_mastery < 0.9);
  assert.equal(b.state.attempts[1].hints_used, 2);
  assert.equal(b.attempt.is_correct, true);
});

test('mastery is sticky: a wrong answer on a mastered skill schedules a review but keeps dependents unlocked', () => {
  const { state, id } = withLearner();
  let s = master(state, id, '3.mult.facts');
  const before = getMastery(s, id, '3.mult.facts');
  assert.ok(before.next_review_at && new Date(before.next_review_at).getTime() > NOW.getTime());
  const r = answer(s, id, '3.mult.facts.easy', 77, false);
  s = r.state;
  const after = getMastery(s, id, '3.mult.facts');
  assert.equal(after.status, 'mastered');
  assert.equal(after.streak, 0);
  assert.ok(after.p_mastery < before.p_mastery);
  assert.equal(after.next_review_at, NOW.toISOString());
  assert.equal(statusOf(s, id, '3.div.facts'), 'learning');
  assert.equal(r.result.newly_mastered, false);
});

test('review intervals grow with the streak and are capped', () => {
  assert.equal(reviewDays(3), 1);
  assert.equal(reviewDays(4), 2);
  assert.equal(reviewDays(5), 4);
  assert.equal(reviewDays(100), 30);
  assert.equal(reviewDays(0), 1);
});

test('applyAttempt keeps p_mastery inside (0, 1)', () => {
  let m = newMastery('L', 'S');
  for (let i = 0; i < 50; i++) m = applyAttempt(m, { is_correct: true, hints_used: 0, guess: 0.1 }, NOW);
  assert.ok(m.p_mastery <= 0.99);
  for (let i = 0; i < 50; i++) m = applyAttempt(m, { is_correct: false, hints_used: 0, guess: 0.1 }, NOW);
  assert.ok(m.p_mastery >= 0.01);
  assert.equal(m.status, 'mastered', 'sticky');
});

test('nextActivity: first learning skill, then due reviews take priority, then null when finished', () => {
  const { state, id } = withLearner();
  const first = nextActivity(state, id, NOW, 3)!;
  assert.equal(first.reason, 'learning');
  assert.equal(first.skill_id, topologicalSkills()[0].id);

  const s = master(state, id, first.skill_id);
  const later = new Date(NOW.getTime() + 40 * DAY);
  const review = nextActivity(s, id, later, 4)!;
  assert.equal(review.reason, 'review');
  assert.equal(review.skill_id, first.skill_id);
  assert.ok(buildProblem(review.template_id, review.seed));

  let all = state;
  for (const skill of topologicalSkills()) all = master(all, id, skill.id);
  assert.equal(nextActivity(all, id, NOW, 5), null);
  assert.ok(nextActivity(all, id, later, 5)?.reason === 'review');
});

test('harder templates are chosen as mastery grows, and the last template is not repeated back to back', () => {
  const { state, id } = withLearner();
  const diff = (s: MathState, seed: number) => buildProblem(nextActivity(s, id, NOW, seed, '3.mult.facts')!.template_id, seed).difficulty;
  const start = diff(state, 1);
  assert.ok(start <= 2);
  let s = state;
  for (let i = 0; i < 2; i++) s = answer(s, id, '3.mult.facts.easy', 20 + i, true).state;
  assert.ok(diff(s, 1) > start);
  const last = s.attempts[s.attempts.length - 1].template_id;
  for (let seed = 0; seed < 20; seed++) assert.notEqual(nextActivity(s, id, NOW, seed, '3.mult.facts')!.template_id, last);
});

test('submitAttempt records an attempt with the seed, params and detected misconception', () => {
  const { state, id } = withLearner();
  const problem = buildProblem('2.addsub.100.carry', 8);
  const { a, b } = problem.params as Record<string, number>;
  const r = submitAttempt(state, id, { template_id: problem.template_id, seed: 8, response: String(a + b - 10), time_ms: 4321.4, hints_used: 1 }, 'A1', NOW);
  assert.ok('state' in r);
  assert.equal(r.result.is_correct, false);
  assert.equal(r.result.misconception?.id, 'forgot_carry');
  assert.equal(r.result.correct_answer, problem.answer);
  assert.ok(r.result.explanation.length > 0);
  assert.deepEqual(r.attempt.problem_instance, { seed: 8, params: problem.params });
  assert.equal(r.attempt.detected_misconception, 'forgot_carry');
  assert.equal(r.attempt.time_ms, 4321);
  assert.equal(r.attempt.created_at, NOW.toISOString());
  assert.equal(state.attempts.length, 0, 'input state is not mutated');
});

test('an equivalent but unsimplified fraction is reported as not_simplified', () => {
  const { state, id } = withLearner();
  const p = buildProblem('4.frac.equiv.simplify', 2);
  const { n, d, g } = p.params as Record<string, number>;
  assert.ok(statusOf(state, id, p.skill_id) === 'locked');
  const unlocked = master(master(state, id, '3.frac.intro'), id, '3.mult.facts');
  const r = submitAttempt(unlocked, id, { template_id: p.template_id, seed: 2, response: `${n * g}/${d * g}`, time_ms: 10, hints_used: 0 }, 'A9', NOW);
  assert.ok('state' in r);
  assert.equal(r.result.is_correct, false);
  assert.equal(r.result.misconception?.id, 'not_simplified');
});

test('submitAttempt rejects bad input', () => {
  const { state, id } = withLearner();
  const base = { template_id: '3.mult.facts.easy', seed: 1, response: '6', time_ms: 1, hints_used: 0 };
  assert.ok('error' in submitAttempt(state, 'nobody', base, 'A', NOW));
  assert.ok('error' in submitAttempt(state, id, { ...base, template_id: 'nope' }, 'A', NOW));
  assert.ok('error' in submitAttempt(state, id, { ...base, response: '   ' }, 'A', NOW));
  assert.ok('error' in submitAttempt(state, id, { ...base, response: 'x'.repeat(201) }, 'A', NOW));
  const weird = submitAttempt(state, id, { ...base, time_ms: NaN, hints_used: -3 }, 'A', NOW);
  assert.ok('state' in weird);
  assert.equal(weird.attempt.time_ms, 0);
  assert.equal(weird.attempt.hints_used, 0);
});

/** Run a placement answering each question with `decide(skillId)`. */
function runPlacement(state: MathState, id: string, decide: (skillId: string) => boolean) {
  const started = startPlacement(state, id, 'PS', NOW);
  assert.ok('state' in started);
  let s = started.state;
  let asked = 0;
  for (;;) {
    const session = s.placements.find((p) => p.id === 'PS')!;
    const q = placementNext(session);
    if (!q) break;
    const problem = buildProblem(q.template_id, q.seed);
    const response = decide(q.skill_id) ? problem.answer : 'wrong';
    const step = answerPlacement(s, 'PS', q, response, NOW);
    assert.ok('state' in step, JSON.stringify(step));
    s = step.state;
    asked++;
    assert.ok(asked <= SKILLS.length * 2, 'placement must be bounded');
    if (step.finished) break;
  }
  return { state: s, asked, session: s.placements.find((p) => p.id === 'PS')! };
}

test('placement with all correct answers passes every skill and marks them mastered', () => {
  const { state, id } = withLearner();
  const r = runPlacement(state, id, () => true);
  assert.equal(r.asked, SKILLS.length * 2);
  assert.ok(r.session.finished_at);
  assert.deepEqual(r.session.result_skill_ids, topologicalSkills().map((s) => s.id));
  for (const s of SKILLS) assert.equal(getMastery(r.state, id, s.id).status, 'mastered');
  assert.equal(activePlacement(r.state, id), undefined);
  assert.equal(r.state.attempts.length, 0, 'placement answers are not practice attempts');
});

test('placement stops early: failing a skill skips everything that depends on it', () => {
  const { state, id } = withLearner();
  const r = runPlacement(state, id, (skill) => skill !== '3.mult.facts');
  const passed = new Set(r.session.result_skill_ids);
  assert.ok(!passed.has('3.mult.facts'));
  for (const skill of ['3.div.facts', '4.mult.multidigit', '4.frac.equiv', '5.frac.add', '6.alg.evaluate', '6.alg.onestep', '7.alg.simplify', '7.alg.twostep']) {
    assert.ok(!passed.has(skill), skill);
    assert.ok(!r.session.answers.some((a) => a.skill_id === skill), `${skill} should not be asked`);
  }
  assert.ok(passed.has('2.addsub.100') && passed.has('3.frac.intro') && passed.has('4.frac.compare'));
  assert.equal(statusOf(r.state, id, '3.mult.facts'), 'learning');
  assert.equal(statusOf(r.state, id, '3.div.facts'), 'locked');
  assert.equal(statusOf(r.state, id, '2.addsub.100'), 'mastered');
});

test('a skill needs both placement questions right; one wrong stops that skill after the first miss', () => {
  const { state, id } = withLearner();
  let first = true;
  const r = runPlacement(state, id, (skill) => {
    if (skill !== '2.addsub.100') return false;
    const ok = first;
    first = false;
    return ok;
  });
  assert.deepEqual(r.session.result_skill_ids, []);
  assert.equal(r.session.answers.filter((a) => a.skill_id === '2.addsub.100').length, 2);
});

test('placement questions are reproducible from the session and reject stale answers', () => {
  const { state, id } = withLearner();
  const started = startPlacement(state, id, 'PS', NOW);
  assert.ok('state' in started);
  const session = started.session;
  const q = placementNext(session)!;
  assert.deepEqual(placementNext({ ...session }), q);
  assert.deepEqual(placementNext({ ...session, id: 'other' })?.skill_id, q.skill_id);
  assert.notEqual(placementNext({ ...session, id: 'other' })?.seed, q.seed);
  assert.equal(activePlacement(started.state, id)?.id, 'PS');

  const stale = answerPlacement(started.state, 'PS', { template_id: q.template_id, seed: q.seed + 1 }, '1', NOW);
  assert.ok('error' in stale);
  assert.ok('error' in answerPlacement(started.state, 'PS', q, '  ', NOW));
  assert.ok('error' in answerPlacement(started.state, 'missing', q, '1', NOW));

  const done = runPlacement(state, id, () => false);
  assert.ok('error' in answerPlacement(done.state, 'PS', q, '1', NOW));
});

test('parseStored accepts saved state and rejects unreadable or newer data', () => {
  const { state } = withLearner();
  const ok = parseStored(JSON.stringify(state));
  assert.equal(ok.status, 'ok');
  assert.deepEqual(ok.state, state);
  assert.equal(parseStored(null).status, 'empty');
  assert.equal(parseStored('{not json').status, 'corrupt');
  assert.equal(parseStored('[]').status, 'corrupt');
  assert.equal(parseStored(JSON.stringify({ ...state, learners: 'x' })).status, 'corrupt');
  assert.equal(parseStored(JSON.stringify({ ...state, placements: [{ id: 'p', learner_id: 'l', started_at: 's' }] })).status, 'corrupt');
  const newer = parseStored(JSON.stringify({ ...state, version: 99 }));
  assert.equal(newer.status, 'newer');
  assert.deepEqual(newer.state, emptyState());
});

test('loadState keeps a backup of unreadable data and saveState reports storage failures', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  data.set(STORAGE_KEY, '{broken');
  const loaded = loadState(storage);
  assert.equal(loaded.status, 'corrupt');
  assert.equal(data.get(BACKUP_KEY), '{broken');

  assert.equal(saveState(storage, emptyState()), null);
  assert.equal(loadState(storage).status, 'ok');

  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.match(saveState(full, emptyState()) ?? '', /could not be saved/);
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => {} };
  assert.equal(loadState(broken).status, 'empty');
});
