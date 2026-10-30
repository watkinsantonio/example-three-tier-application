'use strict';

const crypto = require('crypto');
const { UserError } = require('./errors');
const { SKILLS, SKILL_PREREQS, getSkill } = require('./skills');
const { TEMPLATES, getTemplate, templatesForSkill, buildProblem, publicProblem, detectMisconception } = require('./problems');
const { normalizeResponse, gradeResponse } = require('./grading');
const { newMastery, updateMastery, placeMastery } = require('./mastery');

const GUARDIAN_UNDER_AGE = 13; // learners younger than this need a guardian on file
// Only the birth year is collected, so the exact age is unknown: someone born in
// (thisYear - 13) is 12 or 13. To be safe they are treated as possibly under 13.
// Keep the matching check in renderer/app.js in step.
const MAX_YEARS_NEEDING_GUARDIAN = GUARDIAN_UNDER_AGE; // guardian needed when thisYear - birth_year <= 13
const MAX_ISSUED_PER_LEARNER = 50;
const NOT_SIMPLIFIED = {
  id: 'not-simplified',
  label: 'Right amount, but not in simplest form',
  message: 'That is the right amount, but the fraction or expression can be simplified further.',
};

function ageBand(age) {
  if (age < 8) return 'under-8';
  if (age < 11) return '8-10';
  if (age < 13) return '11-12';
  if (age < 18) return '13-17';
  return '18+';
}

function cleanInt(v, max = 1e9) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), max) : 0;
}

class Engine {
  /**
   * @param {{store: import('./store').Store, now?: () => number, randomSeed?: () => number}} opts
   */
  constructor({ store, now = Date.now, randomSeed = () => crypto.randomInt(1, 2 ** 31 - 1) }) {
    this.store = store;
    this.now = now;
    this.randomSeed = randomSeed;
    // Questions handed out by nextProblem and not yet answered (memory only). Only these can be submitted.
    this.issued = new Map();
  }

  get data() {
    return this.store.data;
  }

  /**
   * Run a change; if saving fails, roll the in-memory data back so memory and disk agree.
   * Known limit: this snapshots and rewrites the whole database on every change, so cost
   * grows with the number of attempts. Fine for one family's use; an append-only log
   * would be the next step if a profile ever holds many thousands of attempts.
   */
  _tx(fn) {
    const snapshot = JSON.parse(JSON.stringify(this.store.data));
    try {
      const result = fn();
      this.store.save();
      return result;
    } catch (e) {
      this.store.data = snapshot;
      throw e;
    }
  }

  _iso() {
    return new Date(this.now()).toISOString();
  }

  // ── Curriculum ─────────────────────────────────────────────────────────────
  listSkills() {
    return SKILLS.map(({ id, name, track, grade_band, description, prereqs }) => ({ id, name, track, grade_band, description, prereqs: [...prereqs], templates: templatesForSkill(id).length }));
  }

  listPrereqs() {
    return SKILL_PREREQS.map((p) => ({ ...p }));
  }

  // ── Learners ───────────────────────────────────────────────────────────────
  createLearner({ display_name, birth_year, guardian_name } = {}) {
    const name = String(display_name == null ? '' : display_name).trim();
    if (!name) throw new UserError('Please enter a name.');
    if (name.length > 40) throw new UserError('That name is too long (40 characters at most).');
    const year = Number(birth_year);
    const thisYear = new Date(this.now()).getUTCFullYear();
    if (!Number.isInteger(year) || year < 1900 || year > thisYear) throw new UserError('Enter a birth year between 1900 and ' + thisYear + '.');
    const age = thisYear - year;
    const gName = guardian_name == null ? '' : String(guardian_name).trim();
    const maybeUnder13 = age <= MAX_YEARS_NEEDING_GUARDIAN;
    if (maybeUnder13 && !gName) throw new UserError('Learners who may be under 13 (born ' + (thisYear - MAX_YEARS_NEEDING_GUARDIAN) + ' or later) need a parent or guardian name.');
    if (gName.length > 60) throw new UserError('The guardian name is too long (60 characters at most).');

    return this._tx(() => {
      let guardian_id = null;
      if (maybeUnder13) {
        guardian_id = crypto.randomUUID();
        this.data.guardians[guardian_id] = { id: guardian_id, name: gName, created_at: this._iso() };
      }
      const learner = { id: crypto.randomUUID(), display_name: name, birth_year: year, age_band: ageBand(age), guardian_id, created_at: this._iso() };
      this.data.learners[learner.id] = learner;
      return { ...learner };
    });
  }

  listLearners() {
    return Object.values(this.data.learners).map((l) => ({ ...l }));
  }

  /** Remove a learner and everything recorded for them (and their guardian record if unshared). */
  deleteLearner({ learner_id }) {
    const learner = this._learner(learner_id);
    return this._tx(() => {
      delete this.data.learners[learner.id];
      this.data.attempts = this.data.attempts.filter((a) => a.learner_id !== learner.id);
      for (const k of Object.keys(this.data.mastery)) if (this.data.mastery[k].learner_id === learner.id) delete this.data.mastery[k];
      for (const k of Object.keys(this.data.placements)) if (this.data.placements[k].learner_id === learner.id) delete this.data.placements[k];
      for (const k of [...this.issued.keys()]) if (k.startsWith(learner.id + '|')) this.issued.delete(k);
      if (learner.guardian_id && !Object.values(this.data.learners).some((l) => l.guardian_id === learner.guardian_id)) delete this.data.guardians[learner.guardian_id];
      return { deleted: true };
    });
  }

  _learner(id) {
    const l = this.data.learners[id];
    if (!l) throw new UserError('That learner profile was not found.');
    return l;
  }

  // ── Mastery ────────────────────────────────────────────────────────────────
  _mastery(learnerId, skillId) {
    return this.data.mastery[learnerId + ':' + skillId] || null;
  }

  _isMastered(learnerId, skillId) {
    const m = this._mastery(learnerId, skillId);
    return !!m && m.status === 'mastered';
  }

  _isLocked(learnerId, skillId) {
    return getSkill(skillId).prereqs.some((p) => !this._isMastered(learnerId, p));
  }

  getProgress({ learner_id }) {
    this._learner(learner_id);
    const now = this.now();
    const skills = SKILLS.map((s) => {
      const m = this._mastery(learner_id, s.id) || newMastery(learner_id, s.id);
      const locked = this._isLocked(learner_id, s.id);
      const status = m.status === 'mastered' ? 'mastered' : locked ? 'locked' : 'learning';
      const due = m.status === 'mastered' && !!m.next_review_at && Date.parse(m.next_review_at) <= now;
      return { skill_id: s.id, name: s.name, track: s.track, grade_band: s.grade_band, description: s.description, p_mastery: m.p_mastery, streak: m.streak, last_practiced_at: m.last_practiced_at, next_review_at: m.next_review_at, status, review_due: due };
    });
    const attempts = this.data.attempts.filter((a) => a.learner_id === learner_id);
    return {
      skills,
      mastered: skills.filter((s) => s.status === 'mastered').length,
      total: skills.length,
      attempts: attempts.length,
      correct: attempts.filter((a) => a.is_correct).length,
    };
  }

  // ── Practice ───────────────────────────────────────────────────────────────
  _pickTemplate(learnerId, skillId, avoidTemplateId) {
    const m = this._mastery(learnerId, skillId) || newMastery(learnerId, skillId);
    const target = Math.max(1, Math.min(5, Math.round(1 + m.p_mastery * 4)));
    let pool = templatesForSkill(skillId);
    if (pool.length > 1) pool = pool.filter((t) => t.id !== avoidTemplateId);
    const best = Math.min(...pool.map((t) => Math.abs(t.difficulty - target)));
    const close = pool.filter((t) => Math.abs(t.difficulty - target) === best);
    return close[this.randomSeed() % close.length];
  }

  _chooseSkill(learnerId) {
    const now = this.now();
    const open = SKILLS.filter((s) => !this._isLocked(learnerId, s.id));
    const due = open
      .map((s) => ({ s, m: this._mastery(learnerId, s.id) }))
      .filter(({ m }) => m && m.status === 'mastered' && m.next_review_at && Date.parse(m.next_review_at) <= now)
      .sort((a, b) => Date.parse(a.m.next_review_at) - Date.parse(b.m.next_review_at));
    if (due.length) return { skill: due[0].s, reason: 'review' };
    const next = open.find((s) => !this._isMastered(learnerId, s.id));
    if (next) return { skill: next, reason: 'learn' };
    const oldest = [...open].sort((a, b) => Date.parse((this._mastery(learnerId, a.id) || {}).last_practiced_at || 0) - Date.parse((this._mastery(learnerId, b.id) || {}).last_practiced_at || 0))[0];
    return { skill: oldest, reason: 'practice' };
  }

  /** Pick what to practise next and generate a fresh problem. */
  nextProblem({ learner_id, skill_id } = {}) {
    this._learner(learner_id);
    let skill;
    let reason = 'chosen';
    if (skill_id) {
      skill = getSkill(skill_id);
      if (!skill) throw new UserError('Unknown skill.');
      if (this._isLocked(learner_id, skill.id)) throw new UserError('Master the earlier skills first to unlock "' + skill.name + '".');
    } else {
      ({ skill, reason } = this._chooseSkill(learner_id));
    }
    const last = [...this.data.attempts].reverse().find((a) => a.learner_id === learner_id && a.skill_id === skill.id);
    const template = this._pickTemplate(learner_id, skill.id, last && last.template_id);
    const problem = buildProblem(template.id, this.randomSeed());
    this._issue(learner_id, problem.template_id, problem.seed);
    return { reason, skill: { id: skill.id, name: skill.name, track: skill.track }, problem: publicProblem(problem) };
  }

  /** Remember that this exact question was given to this learner. The oldest are forgotten past a cap. */
  _issue(learnerId, templateId, seed) {
    const prefix = learnerId + '|';
    this.issued.set(prefix + templateId + '|' + seed, true);
    const mine = [...this.issued.keys()].filter((k) => k.startsWith(prefix));
    for (const k of mine.slice(0, Math.max(0, mine.length - MAX_ISSUED_PER_LEARNER))) this.issued.delete(k);
  }

  _grade(problem, response) {
    const normalized = normalizeResponse(problem.type, response, problem);
    const { is_correct, flags } = gradeResponse(problem.type, normalized, problem);
    let misconception = null;
    if (!is_correct) {
      misconception = detectMisconception(problem.template_id, normalized, problem);
      if (!misconception && flags.includes('not-simplified')) misconception = { ...NOT_SIMPLIFIED };
    }
    return { is_correct, misconception };
  }

  _recordAttempt(learnerId, problem, response, graded, { time_ms, hints_used }) {
    const attempt = {
      id: crypto.randomUUID(),
      learner_id: learnerId,
      skill_id: problem.skill_id,
      template_id: problem.template_id,
      problem_instance: { seed: problem.seed, params: problem.params },
      response,
      is_correct: graded.is_correct,
      detected_misconception: graded.misconception ? graded.misconception.id : null,
      time_ms: cleanInt(time_ms),
      hints_used: Math.min(cleanInt(hints_used), problem.hints.length),
      created_at: this._iso(),
    };
    this.data.attempts.push(attempt);
    return attempt;
  }

  _alreadyAnswered(learnerId, templateId, seed) {
    return this.data.attempts.some((a) => a.learner_id === learnerId && a.template_id === templateId && a.problem_instance.seed === seed);
  }

  submitAnswer({ learner_id, template_id, seed, response, time_ms = 0, hints_used = 0 } = {}) {
    this._learner(learner_id);
    const template = getTemplate(template_id);
    if (!template) throw new UserError('Unknown question.');
    if (this._isLocked(learner_id, template.skill_id)) throw new UserError('That skill is still locked.');
    const problem = buildProblem(template_id, seed);
    if (this._alreadyAnswered(learner_id, template_id, seed)) throw new UserError('You already answered this question. Ask for a new one.');
    const issuedKey = learner_id + '|' + template_id + '|' + problem.seed;
    if (!this.issued.has(issuedKey)) throw new UserError('That question was not given to you (or the app was restarted). Ask for a new one.');
    const graded = this._grade(problem, response);

    const result = this._tx(() => {
      const attempt = this._recordAttempt(learner_id, problem, response, graded, { time_ms, hints_used });
      const before = this._mastery(learner_id, problem.skill_id) || newMastery(learner_id, problem.skill_id);
      const after = updateMastery(before, { is_correct: graded.is_correct, hints_used: attempt.hints_used }, this.now());
      this.data.mastery[learner_id + ':' + problem.skill_id] = after;
      const newly = before.status !== 'mastered' && after.status === 'mastered';
      const unlocked = newly
        ? SKILLS.filter((s) => s.prereqs.includes(problem.skill_id) && !this._isLocked(learner_id, s.id)).map((s) => s.name)
        : [];
      return {
        is_correct: graded.is_correct,
        misconception: graded.misconception,
        explanation: problem.explanation,
        correct_answer: problem.answer_text,
        mastery: { p_mastery: after.p_mastery, streak: after.streak, status: after.status },
        newly_mastered: newly,
        unlocked_skills: unlocked,
      };
    });
    this.issued.delete(issuedKey);
    return result;
  }

  // ── Placement ──────────────────────────────────────────────────────────────
  _placement(id) {
    const p = this.data.placements[id];
    if (!p) throw new UserError('That placement check was not found.');
    return p;
  }

  /** Skills already shown to be known: asked-and-passed, plus their prerequisites. */
  _placementPassed(p) {
    const passed = new Set();
    for (const a of p.asked) {
      if (a.is_correct) {
        passed.add(a.skill_id);
        const walk = (id) => getSkill(id).prereqs.forEach((q) => { passed.add(q); walk(q); });
        walk(a.skill_id);
      }
    }
    return passed;
  }

  _placementNextSkill(p) {
    const passed = this._placementPassed(p);
    const askedIds = new Set(p.asked.map((a) => a.skill_id));
    return SKILLS.find((s) => !passed.has(s.id) && !askedIds.has(s.id) && s.prereqs.every((q) => passed.has(q))) || null;
  }

  _placementTemplate(skillId) {
    const pool = templatesForSkill(skillId);
    const open = pool.filter((t) => t.type !== 'multiple_choice');
    const list = open.length ? open : pool;
    return list.reduce((a, b) => (Math.abs(b.difficulty - 2) < Math.abs(a.difficulty - 2) ? b : a));
  }

  _placementAdvance(p) {
    const skill = this._placementNextSkill(p);
    if (!skill) {
      p.pending = null;
      p.finished_at = this._iso();
      p.result_skill_ids = SKILLS.filter((s) => this._placementPassed(p).has(s.id)).map((s) => s.id);
      for (const id of p.result_skill_ids) {
        const key = p.learner_id + ':' + id;
        this.data.mastery[key] = placeMastery(this.data.mastery[key] || newMastery(p.learner_id, id), this.now());
      }
      return;
    }
    p.pending = { skill_id: skill.id, template_id: this._placementTemplate(skill.id).id, seed: this.randomSeed() };
  }

  startPlacement({ learner_id }) {
    this._learner(learner_id);
    const existing = Object.values(this.data.placements).find((p) => p.learner_id === learner_id && !p.finished_at);
    if (existing) return { placement_id: existing.id };
    return this._tx(() => {
      const p = { id: crypto.randomUUID(), learner_id, started_at: this._iso(), finished_at: null, result_skill_ids: [], asked: [], pending: null };
      this._placementAdvance(p);
      this.data.placements[p.id] = p;
      return { placement_id: p.id };
    });
  }

  /**
   * Safe to call any number of times: it re-sends the same pending question until it is answered.
   * @returns {{finished:boolean, result_skill_ids?:string[], problem?:object, number?:number}}
   */
  nextPlacementProblem({ placement_id }) {
    const p = this._placement(placement_id);
    if (p.finished_at || !p.pending) return { finished: true, result_skill_ids: [...p.result_skill_ids], skills_known: p.result_skill_ids.length };
    const problem = buildProblem(p.pending.template_id, p.pending.seed);
    return { finished: false, number: p.asked.length + 1, problem: publicProblem(problem) };
  }

  submitPlacementAnswer({ placement_id, response, time_ms = 0, hints_used = 0 }) {
    const p = this._placement(placement_id);
    if (p.finished_at || !p.pending) throw new UserError('This placement check is already finished.');
    const problem = buildProblem(p.pending.template_id, p.pending.seed);
    const graded = this._grade(problem, response);
    return this._tx(() => {
      const live = this._placement(placement_id);
      this._recordAttempt(live.learner_id, problem, response, graded, { time_ms, hints_used });
      live.asked.push({ skill_id: problem.skill_id, template_id: problem.template_id, seed: problem.seed, is_correct: graded.is_correct });
      live.pending = null;
      this._placementAdvance(live);
      return { is_correct: graded.is_correct, finished: !!live.finished_at, result_skill_ids: [...live.result_skill_ids] };
    });
  }
}

module.exports = { Engine, GUARDIAN_UNDER_AGE, ageBand, TEMPLATES };
