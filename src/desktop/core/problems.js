'use strict';

const { createRng } = require('./rng');
const { UserError } = require('./errors');
const { answerText } = require('./grading');
const { NUMBER_TEMPLATES } = require('./templates-number');
const { FRACTION_TEMPLATES } = require('./templates-fractions');
const { ALGEBRA_TEMPLATES } = require('./templates-algebra');

const TYPES = ['numeric', 'multiple_choice', 'drag', 'fraction', 'expression'];
const TEMPLATES = [...NUMBER_TEMPLATES, ...FRACTION_TEMPLATES, ...ALGEBRA_TEMPLATES];
const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

function getTemplate(id) {
  return BY_ID.get(id) || null;
}

function templatesForSkill(skillId) {
  return TEMPLATES.filter((t) => t.skill_id === skillId);
}

/** Deterministically build the full problem (including the answer) from a template and a seed. */
function buildProblem(templateId, seed) {
  const t = getTemplate(templateId);
  if (!t) throw new UserError('Unknown problem type: ' + templateId);
  if (!Number.isInteger(seed)) throw new UserError('Bad problem seed.');
  const g = t.generate(createRng(seed));
  const problem = {
    template_id: t.id,
    skill_id: t.skill_id,
    difficulty: t.difficulty,
    type: t.type,
    seed,
    params: g.params,
    prompt: g.prompt,
    choices: g.choices || null,
    items: g.items || null,
    answer: g.answer,
    mode: g.mode || null,
  };
  const ctx = { answer: g.answer };
  problem.hints = t.hint_steps(g.params, ctx);
  problem.answer_text = answerText(t.type, problem);
  problem.explanation = t.explanation(g.params, { ...ctx, answer_text: problem.answer_text });
  return problem;
}

/** What the learner's screen may see: never the answer. */
function publicProblem(p) {
  return {
    template_id: p.template_id,
    skill_id: p.skill_id,
    difficulty: p.difficulty,
    type: p.type,
    seed: p.seed,
    prompt: p.prompt,
    choices: p.choices,
    items: p.items,
    hints: p.hints,
  };
}

/** First misconception check that matches an incorrect response. */
function detectMisconception(templateId, normalized, problem) {
  const t = getTemplate(templateId);
  for (const m of t.misconception_checks) {
    let hit = false;
    try {
      hit = m.test(normalized, { params: problem.params, answer: problem.answer });
    } catch {
      hit = false;
    }
    if (hit) return { id: m.id, label: m.label, message: m.message };
  }
  return null;
}

module.exports = { TYPES, TEMPLATES, getTemplate, templatesForSkill, buildProblem, publicProblem, detectMisconception };
