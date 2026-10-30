import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProblem } from './curriculum.ts';
import {
  answerPlacement,
  createLearner,
  emptyState,
  nextActivity,
  placementNext,
  startPlacement,
  submitAttempt,
} from './engine.ts';
import { parseStored } from './storage.ts';
import type { MathState } from './types.ts';

const NOW = new Date('2026-03-01T12:00:00Z');

/** A realistic saved state: a young learner with a guardian, a practice attempt and a placement answer. */
function populated(): MathState {
  const made = createLearner(emptyState(), { display_name: 'Kit', birth_year: 2018, guardian_name: 'Pat' }, { learner: 'L1', guardian: 'G1' }, NOW);
  assert.ok('state' in made);
  const activity = nextActivity(made.state, 'L1', NOW, 9)!;
  const attempt = submitAttempt(
    made.state,
    'L1',
    { template_id: activity.template_id, seed: 9, response: buildProblem(activity.template_id, 9).answer, time_ms: 1200, hints_used: 1 },
    'A1',
    NOW,
  );
  assert.ok('state' in attempt);
  const started = startPlacement(attempt.state, 'L1', 'P1', NOW);
  assert.ok('state' in started);
  const q = placementNext(started.session)!;
  const step = answerPlacement(started.state, 'P1', q, 'wrong', NOW);
  assert.ok('state' in step);
  return step.state;
}

type Mutate = (s: Record<string, any>) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

const DAMAGE: [string, Mutate][] = [
  ['p_mastery missing', (s) => delete s.masteries[0].p_mastery],
  ['p_mastery above 1', (s) => (s.masteries[0].p_mastery = 1.5)],
  ['p_mastery negative', (s) => (s.masteries[0].p_mastery = -0.1)],
  ['p_mastery a string', (s) => (s.masteries[0].p_mastery = '0.5')],
  ['p_mastery null (NaN saved as null)', (s) => (s.masteries[0].p_mastery = null)],
  ['streak fractional', (s) => (s.masteries[0].streak = 1.5)],
  ['streak negative', (s) => (s.masteries[0].streak = -1)],
  ['mastery status unknown', (s) => (s.masteries[0].status = 'expert')],
  ['next_review_at not a date', (s) => (s.masteries[0].next_review_at = 'soon')],
  ['next_review_at a number', (s) => (s.masteries[0].next_review_at = 5)],
  ['birth_year missing', (s) => delete s.learners[0].birth_year],
  ['birth_year a string', (s) => (s.learners[0].birth_year = '2018')],
  ['guardian_id undefined', (s) => delete s.learners[0].guardian_id],
  ['guardian_id a number', (s) => (s.learners[0].guardian_id = 7)],
  ['created_at not a date', (s) => (s.learners[0].created_at = 'yesterday')],
  ['attempt problem_instance missing', (s) => delete s.attempts[0].problem_instance],
  ['attempt seed a string', (s) => (s.attempts[0].problem_instance.seed = 'x')],
  ['attempt params an array', (s) => (s.attempts[0].problem_instance.params = [])],
  ['attempt params with an object value', (s) => (s.attempts[0].problem_instance.params = { a: {} })],
  ['attempt is_correct a string', (s) => (s.attempts[0].is_correct = 'yes')],
  ['attempt response missing', (s) => delete s.attempts[0].response],
  ['attempt time_ms negative', (s) => (s.attempts[0].time_ms = -5)],
  ['attempt hints_used missing', (s) => delete s.attempts[0].hints_used],
  ['attempt detected_misconception undefined', (s) => delete s.attempts[0].detected_misconception],
  ['placement answer missing seed', (s) => delete s.placements[0].answers[0].seed],
  ['placement answer is_correct a number', (s) => (s.placements[0].answers[0].is_correct = 1)],
  ['placement answers not an array', (s) => (s.placements[0].answers = {})],
  ['placement finished_at invalid', (s) => (s.placements[0].finished_at = 'never')],
  ['placement result ids contain a number', (s) => (s.placements[0].result_skill_ids = [1])],
  ['guardians not an array', (s) => (s.guardians = null)],
  ['an array item is null', (s) => (s.learners = [null])],
];

test('a fully populated saved state is accepted unchanged', () => {
  const state = populated();
  assert.equal(state.guardians.length, 1);
  assert.ok(state.attempts.length === 1 && state.masteries.length >= 1 && state.placements[0].answers.length === 1);
  const parsed = parseStored(JSON.stringify(state));
  assert.equal(parsed.status, 'ok');
  assert.deepEqual(parsed.state, state);
});

for (const [name, damage] of DAMAGE) {
  test(`damaged saved data is reported as corrupt: ${name}`, () => {
    const data = JSON.parse(JSON.stringify(populated()));
    damage(data);
    const parsed = parseStored(JSON.stringify(data));
    assert.equal(parsed.status, 'corrupt');
    assert.deepEqual(parsed.state, emptyState());
  });
}

test('a missing or wrong version is not accepted as current data', () => {
  const data = JSON.parse(JSON.stringify(populated()));
  data.version = 0;
  assert.equal(parseStored(JSON.stringify(data)).status, 'corrupt');
  delete data.version;
  assert.equal(parseStored(JSON.stringify(data)).status, 'corrupt');
});
