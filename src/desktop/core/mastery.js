'use strict';

// Skill mastery: Bayesian Knowledge Tracing plus a simple spaced-review schedule.

const BKT = { p_init: 0.1, p_learn: 0.18, p_slip: 0.08, p_guess: 0.2 };
const MASTERED_P = 0.95;
const MASTERED_STREAK = 3;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
// Gap before the next review, by current streak of correct answers.
const REVIEW_GAPS = [10 * MINUTE, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];

function newMastery(learnerId, skillId) {
  return { learner_id: learnerId, skill_id: skillId, p_mastery: BKT.p_init, streak: 0, last_practiced_at: null, next_review_at: null, status: 'learning' };
}

/**
 * Update a mastery record after one attempt. Using hints weakens the evidence
 * of a correct answer (the learner had help), and counts as a higher guess rate.
 */
function updateMastery(prev, { is_correct, hints_used = 0 }, nowMs) {
  const guess = Math.min(0.6, BKT.p_guess + 0.15 * hints_used);
  const p = prev.p_mastery;
  const posterior = is_correct
    ? (p * (1 - BKT.p_slip)) / (p * (1 - BKT.p_slip) + (1 - p) * guess)
    : (p * BKT.p_slip) / (p * BKT.p_slip + (1 - p) * (1 - guess));
  const p_mastery = Math.min(0.999, posterior + (1 - posterior) * BKT.p_learn);
  const streak = is_correct ? prev.streak + 1 : 0;
  // Mastery is sticky: once earned it is kept, so a slip on a review question never
  // re-locks the skills that depend on it. A wrong answer lowers p_mastery and
  // schedules a quick review instead (see REVIEW_GAPS[0]).
  const status = prev.status === 'mastered' || (p_mastery >= MASTERED_P && streak >= MASTERED_STREAK) ? 'mastered' : 'learning';
  const gap = REVIEW_GAPS[Math.min(streak, REVIEW_GAPS.length - 1)];
  return {
    ...prev,
    p_mastery,
    streak,
    status,
    last_practiced_at: new Date(nowMs).toISOString(),
    next_review_at: new Date(nowMs + gap).toISOString(),
  };
}

/** Record that placement showed the learner already knows this skill. */
function placeMastery(prev, nowMs) {
  return {
    ...prev,
    p_mastery: Math.max(prev.p_mastery, MASTERED_P),
    streak: Math.max(prev.streak, MASTERED_STREAK),
    status: 'mastered',
    last_practiced_at: new Date(nowMs).toISOString(),
    next_review_at: new Date(nowMs + REVIEW_GAPS[3]).toISOString(),
  };
}

module.exports = { BKT, MASTERED_P, MASTERED_STREAK, REVIEW_GAPS, newMastery, updateMastery, placeMastery };
