import {
  buildProblem,
  getSkill,
  getTemplate,
  prereqsOf,
  templatesForSkill,
  topologicalSkills,
} from './curriculum.ts';
import { detectMisconception, isCorrect, isUnsimplifiedEquivalent } from './grading.ts';
import { applyAttempt, guessRate, newMastery, placeAsMastered } from './mastery.ts';
import { createRng, hashSeed } from './rng.ts';
import {
  STORE_VERSION,
  type Attempt,
  type Learner,
  type MasteryStatus,
  type MathState,
  type PlacementSession,
  type ProblemInstance,
  type Skill,
  type SkillMastery,
} from './types.ts';

export const GUARDIAN_AGE_LIMIT = 13;
export const MAX_NAME_LENGTH = 40;
export const MAX_RESPONSE_LENGTH = 200;
export const NOT_SIMPLIFIED = {
  id: 'not_simplified',
  description: 'Right value but not in simplest form',
  feedback: 'That has the right value, but it is not in simplest form yet.',
};

export function emptyState(): MathState {
  return { version: STORE_VERSION, guardians: [], learners: [], attempts: [], masteries: [], placements: [] };
}

// ---------- learners ----------

/**
 * "Under 13" judged by birth year alone: anyone who is 13 or younger by year difference counts, because they may not
 * have turned 13 yet this year. This deliberately errs on the side of asking for a guardian. The guardian is only a
 * name on file, not verified consent.
 */
export function needsGuardian(birthYear: number, now: Date): boolean {
  return now.getFullYear() - birthYear <= GUARDIAN_AGE_LIMIT;
}

export interface NewLearnerInput {
  display_name: string;
  birth_year: number;
  guardian_name?: string;
}

export function createLearner(
  state: MathState,
  input: NewLearnerInput,
  ids: { learner: string; guardian: string },
  now: Date,
): { state: MathState; learner: Learner } | { error: string } {
  const name = typeof input.display_name === 'string' ? input.display_name.trim() : '';
  if (!name) return { error: 'Enter a display name.' };
  if (name.length > MAX_NAME_LENGTH) return { error: `Names must be ${MAX_NAME_LENGTH} characters or fewer.` };
  if (state.learners.some((l) => l.display_name.toLowerCase() === name.toLowerCase())) {
    return { error: 'A learner with that name already exists.' };
  }
  const year = input.birth_year;
  if (!Number.isInteger(year) || year < now.getFullYear() - 110 || year > now.getFullYear()) {
    return { error: 'Enter a valid birth year.' };
  }
  let guardianId: string | null = null;
  const guardians = [...state.guardians];
  if (needsGuardian(year, now)) {
    const guardianName = (input.guardian_name ?? '').trim();
    if (!guardianName) return { error: 'A parent or guardian name is required for learners 13 or younger.' };
    if (guardianName.length > MAX_NAME_LENGTH) return { error: `Names must be ${MAX_NAME_LENGTH} characters or fewer.` };
    guardianId = ids.guardian;
    guardians.push({ id: ids.guardian, name: guardianName });
  }
  const learner: Learner = {
    id: ids.learner,
    display_name: name,
    birth_year: year,
    guardian_id: guardianId,
    created_at: now.toISOString(),
  };
  return { state: { ...state, guardians, learners: [...state.learners, learner] }, learner };
}

/** Remove a learner and everything recorded for them (including a guardian no other learner uses). */
export function deleteLearner(state: MathState, learnerId: string): MathState {
  const learner = state.learners.find((l) => l.id === learnerId);
  const learners = state.learners.filter((l) => l.id !== learnerId);
  const keepGuardians = new Set(learners.map((l) => l.guardian_id));
  return {
    ...state,
    learners,
    guardians: state.guardians.filter((g) => g.id !== learner?.guardian_id || keepGuardians.has(g.id)),
    attempts: state.attempts.filter((a) => a.learner_id !== learnerId),
    masteries: state.masteries.filter((m) => m.learner_id !== learnerId),
    placements: state.placements.filter((p) => p.learner_id !== learnerId),
  };
}

// ---------- mastery ----------

function masteryRow(state: MathState, learnerId: string, skillId: string): SkillMastery {
  return (
    state.masteries.find((m) => m.learner_id === learnerId && m.skill_id === skillId) ??
    newMastery(learnerId, skillId)
  );
}

/** Status derived from stored mastery and prerequisites: mastered, else learning if all prereqs are mastered, else locked. */
export function statusOf(state: MathState, learnerId: string, skillId: string): MasteryStatus {
  if (masteryRow(state, learnerId, skillId).status === 'mastered') return 'mastered';
  return prereqsOf(skillId).every((p) => masteryRow(state, learnerId, p).status === 'mastered')
    ? 'learning'
    : 'locked';
}

export function getMastery(state: MathState, learnerId: string, skillId: string): SkillMastery {
  return { ...masteryRow(state, learnerId, skillId), status: statusOf(state, learnerId, skillId) };
}

export interface SkillProgress {
  skill: Skill;
  mastery: SkillMastery;
  review_due: boolean;
}

export function skillProgress(state: MathState, learnerId: string, now: Date): SkillProgress[] {
  return topologicalSkills().map((skill) => {
    const mastery = getMastery(state, learnerId, skill.id);
    const review_due =
      mastery.status === 'mastered' &&
      mastery.next_review_at !== null &&
      new Date(mastery.next_review_at).getTime() <= now.getTime();
    return { skill, mastery, review_due };
  });
}

function upsertMastery(state: MathState, row: SkillMastery): MathState {
  const rest = state.masteries.filter((m) => !(m.learner_id === row.learner_id && m.skill_id === row.skill_id));
  return { ...state, masteries: [...rest, row] };
}

// ---------- choosing what to practise ----------

export interface Activity {
  skill_id: string;
  template_id: string;
  seed: number;
  reason: 'review' | 'learning' | 'chosen';
}

function pickTemplateId(
  state: MathState,
  learnerId: string,
  skillId: string,
  minDifficulty: number,
  seed: number,
): string {
  const templates = templatesForSkill(skillId);
  const p = masteryRow(state, learnerId, skillId).p_mastery;
  const target = Math.min(5, Math.max(minDifficulty, Math.round(1 + p * 4)));
  const lastAttempt = [...state.attempts].reverse().find((a) => a.learner_id === learnerId && a.skill_id === skillId);
  let ranked = [...templates].sort(
    (a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) || a.difficulty - b.difficulty,
  );
  if (ranked.length > 1 && lastAttempt) ranked = ranked.filter((t) => t.id !== lastAttempt.template_id);
  const best = Math.abs(ranked[0].difficulty - target);
  const ties = ranked.filter((t) => Math.abs(t.difficulty - target) === best);
  return ties[Math.floor(createRng(seed)() * ties.length)].id;
}

/** What should this learner do next? Due reviews first, then the first skill still being learned. */
export function nextActivity(
  state: MathState,
  learnerId: string,
  now: Date,
  seed: number,
  skillId?: string,
): Activity | null {
  if (skillId) {
    if (!getSkill(skillId) || statusOf(state, learnerId, skillId) === 'locked') return null;
    return { skill_id: skillId, template_id: pickTemplateId(state, learnerId, skillId, 1, seed), seed, reason: 'chosen' };
  }
  const progress = skillProgress(state, learnerId, now);
  const due = progress
    .filter((p) => p.review_due)
    .sort((a, b) => (a.mastery.next_review_at ?? '').localeCompare(b.mastery.next_review_at ?? ''))[0];
  if (due) {
    return { skill_id: due.skill.id, template_id: pickTemplateId(state, learnerId, due.skill.id, 3, seed), seed, reason: 'review' };
  }
  const learning = progress.find((p) => p.mastery.status === 'learning');
  if (learning) {
    return { skill_id: learning.skill.id, template_id: pickTemplateId(state, learnerId, learning.skill.id, 1, seed), seed, reason: 'learning' };
  }
  return null;
}

// ---------- attempts ----------

export interface AttemptResult {
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  misconception: { id: string; description: string; feedback: string } | null;
  newly_mastered: boolean;
  mastery: SkillMastery;
}

export interface SubmitInput {
  template_id: string;
  seed: number;
  response: string;
  time_ms: number;
  hints_used: number;
}

function gradeProblem(problem: ProblemInstance, response: string) {
  const template = getTemplate(problem.template_id)!;
  const correct = isCorrect(problem, response);
  let misconception: AttemptResult['misconception'] = null;
  if (!correct) {
    const found = detectMisconception(template.misconception_checks, problem, response);
    if (found) misconception = { id: found.id, description: found.description, feedback: found.feedback };
    else if (isUnsimplifiedEquivalent(problem.type, response, problem.answer)) misconception = NOT_SIMPLIFIED;
  }
  return { template, correct, misconception };
}

export function submitAttempt(
  state: MathState,
  learnerId: string,
  input: SubmitInput,
  attemptId: string,
  now: Date,
): { state: MathState; attempt: Attempt; result: AttemptResult } | { error: string } {
  if (!state.learners.some((l) => l.id === learnerId)) return { error: 'Unknown learner.' };
  if (!getTemplate(input.template_id)) return { error: 'Unknown problem.' };
  if (typeof input.response !== 'string') return { error: 'Enter an answer.' };
  const response = input.response.trim();
  if (!response) return { error: 'Enter an answer.' };
  if (response.length > MAX_RESPONSE_LENGTH) return { error: 'That answer is too long.' };
  const problem = buildProblem(input.template_id, input.seed);
  if (statusOf(state, learnerId, problem.skill_id) === 'locked') return { error: 'That skill is still locked.' };

  const { correct, misconception } = gradeProblem(problem, response);
  const hints = Math.max(0, Math.floor(input.hints_used) || 0);
  const prev = masteryRow(state, learnerId, problem.skill_id);
  const updated = applyAttempt(
    prev,
    { is_correct: correct, hints_used: hints, guess: guessRate(problem.type, problem.choices?.length) },
    now,
  );
  const attempt: Attempt = {
    id: attemptId,
    learner_id: learnerId,
    skill_id: problem.skill_id,
    template_id: problem.template_id,
    problem_instance: { seed: problem.seed, params: problem.params },
    response,
    is_correct: correct,
    detected_misconception: misconception?.id ?? null,
    time_ms: Math.max(0, Math.round(input.time_ms) || 0),
    hints_used: hints,
    created_at: now.toISOString(),
  };
  const next = upsertMastery({ ...state, attempts: [...state.attempts, attempt] }, updated);
  const template = getTemplate(problem.template_id)!;
  return {
    state: next,
    attempt,
    result: {
      is_correct: correct,
      correct_answer: problem.answer,
      explanation: template.explanation(problem.params, problem.answer),
      misconception,
      newly_mastered: prev.status !== 'mastered' && updated.status === 'mastered',
      mastery: getMastery(next, learnerId, problem.skill_id),
    },
  };
}

/** Rebuild the problem plus its hints for display. */
export function presentProblem(templateId: string, seed: number) {
  const problem = buildProblem(templateId, seed);
  return { problem, hints: getTemplate(templateId)!.hint_steps(problem.params) };
}

// ---------- placement ----------

export function startPlacement(
  state: MathState,
  learnerId: string,
  sessionId: string,
  now: Date,
): { state: MathState; session: PlacementSession } | { error: string } {
  if (!state.learners.some((l) => l.id === learnerId)) return { error: 'Unknown learner.' };
  const session: PlacementSession = {
    id: sessionId,
    learner_id: learnerId,
    started_at: now.toISOString(),
    finished_at: null,
    result_skill_ids: [],
    answers: [],
  };
  return { state: { ...state, placements: [...state.placements, session] }, session };
}

export function activePlacement(state: MathState, learnerId: string): PlacementSession | undefined {
  return state.placements.find((p) => p.learner_id === learnerId && p.finished_at === null);
}

export interface PlacementQuestion {
  skill_id: string;
  template_id: string;
  seed: number;
}

/**
 * Next placement question, derived from the answers so far. Skills are visited in prerequisite order; each skill gets
 * up to two questions (an easier then a harder one) and is passed only if both are right. A skill whose prerequisite
 * was not passed is skipped, so a struggling learner is not asked about things far above their level.
 */
export function placementNext(session: PlacementSession): PlacementQuestion | null {
  const passed = new Set<string>();
  for (const skill of topologicalSkills()) {
    if (!prereqsOf(skill.id).every((p) => passed.has(p))) continue;
    const templates = templatesForSkill(skill.id);
    const answers = session.answers.filter((a) => a.skill_id === skill.id);
    const n = templates.length;
    const question = (index: number): PlacementQuestion => ({
      skill_id: skill.id,
      template_id: templates[Math.floor(((n - 1) * index) / 3)].id,
      seed: hashSeed(`${session.id}:${skill.id}:${index}`),
    });
    if (answers.length === 0) return question(1);
    if (!answers[0].is_correct) continue;
    if (answers.length === 1) return question(2);
    if (answers.every((a) => a.is_correct)) passed.add(skill.id);
  }
  return null;
}

function passedSkillIds(session: PlacementSession): string[] {
  return topologicalSkills()
    .filter((s) => {
      const answers = session.answers.filter((a) => a.skill_id === s.id);
      return answers.length >= 2 && answers.every((a) => a.is_correct);
    })
    .map((s) => s.id);
}

export interface PlacementStep {
  state: MathState;
  is_correct: boolean;
  finished: boolean;
  result_skill_ids: string[];
}

/** Record an answer to the current placement question; finishes the session when there are no more questions. */
export function answerPlacement(
  state: MathState,
  sessionId: string,
  question: { template_id: string; seed: number },
  response: string,
  now: Date,
): PlacementStep | { error: string } {
  const session = state.placements.find((p) => p.id === sessionId);
  if (!session) return { error: 'Unknown placement check.' };
  if (session.finished_at) return { error: 'This placement check is already finished.' };
  const current = placementNext(session);
  if (!current || current.template_id !== question.template_id || current.seed !== question.seed) {
    return { error: 'That is not the current question.' };
  }
  if (typeof response !== 'string' || !response.trim()) return { error: 'Enter an answer.' };
  if (response.length > MAX_RESPONSE_LENGTH) return { error: 'That answer is too long.' };

  const problem = buildProblem(current.template_id, current.seed);
  const updatedSession: PlacementSession = {
    ...session,
    answers: [
      ...session.answers,
      {
        skill_id: current.skill_id,
        template_id: current.template_id,
        seed: current.seed,
        is_correct: isCorrect(problem, response.trim()),
      },
    ],
  };
  let next: MathState = {
    ...state,
    placements: state.placements.map((p) => (p.id === sessionId ? updatedSession : p)),
  };
  const finished = placementNext(updatedSession) === null;
  if (finished) next = finishPlacement(next, sessionId, now);
  const final = next.placements.find((p) => p.id === sessionId)!;
  return {
    state: next,
    is_correct: updatedSession.answers[updatedSession.answers.length - 1].is_correct,
    finished,
    result_skill_ids: final.result_skill_ids,
  };
}

/** Close a placement session and mark the skills it showed the learner already knows as mastered. */
export function finishPlacement(state: MathState, sessionId: string, now: Date): MathState {
  const session = state.placements.find((p) => p.id === sessionId);
  if (!session || session.finished_at) return state;
  const passed = passedSkillIds(session);
  let next: MathState = {
    ...state,
    placements: state.placements.map((p) =>
      p.id === sessionId ? { ...p, finished_at: now.toISOString(), result_skill_ids: passed } : p,
    ),
  };
  for (const skillId of passed) {
    next = upsertMastery(next, placeAsMastered(masteryRow(next, session.learner_id, skillId), now));
  }
  return next;
}
