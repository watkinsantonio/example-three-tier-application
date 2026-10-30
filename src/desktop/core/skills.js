'use strict';

// Skill graph. `prereqs` are the SkillPrereq edges (skill -> prerequisite).
// Order here is a valid teaching order (every prerequisite comes first).

const SKILLS = [
  { id: '2.num.order', name: 'Ordering whole numbers', track: 'Number & Operations', grade_band: '2-3', description: 'Put whole numbers in order from smallest to largest.', prereqs: [] },
  { id: '3.add.regroup', name: 'Adding with regrouping', track: 'Number & Operations', grade_band: '3', description: 'Add 2- and 3-digit numbers when you have to carry.', prereqs: ['2.num.order'] },
  { id: '3.mult.facts', name: 'Multiplication facts', track: 'Number & Operations', grade_band: '3', description: 'Quickly recall products up to 12 × 12.', prereqs: ['3.add.regroup'] },
  { id: '3.div.facts', name: 'Division facts', track: 'Number & Operations', grade_band: '3', description: 'Use multiplication facts to divide.', prereqs: ['3.mult.facts'] },
  { id: '4.mult.multidigit', name: 'Multiplying by one digit', track: 'Number & Operations', grade_band: '4', description: 'Multiply 2- and 3-digit numbers by a single digit.', prereqs: ['3.mult.facts'] },
  { id: '4.frac.equiv', name: 'Equivalent fractions', track: 'Fractions', grade_band: '4', description: 'Write fractions that name the same amount, and simplify them.', prereqs: ['3.mult.facts', '3.div.facts'] },
  { id: '4.frac.compare', name: 'Comparing fractions', track: 'Fractions', grade_band: '4', description: 'Decide which of two or more fractions is larger.', prereqs: ['4.frac.equiv'] },
  { id: '4.frac.order', name: 'Ordering fractions', track: 'Fractions', grade_band: '4-5', description: 'Put fractions in order from smallest to largest.', prereqs: ['4.frac.compare'] },
  { id: '5.frac.add.like', name: 'Adding fractions with the same bottom number', track: 'Fractions', grade_band: '5', description: 'Add fractions that share a denominator.', prereqs: ['3.add.regroup', '4.frac.equiv'] },
  { id: '5.frac.add.unlike', name: 'Adding fractions with different bottom numbers', track: 'Fractions', grade_band: '5', description: 'Find a common denominator, then add.', prereqs: ['5.frac.add.like', '4.frac.equiv'] },
  { id: '6.expr.evaluate', name: 'Evaluating expressions', track: 'Algebra', grade_band: '6', description: 'Replace a letter with a number and work out the value.', prereqs: ['4.mult.multidigit'] },
  { id: '6.expr.simplify', name: 'Simplifying expressions', track: 'Algebra', grade_band: '6-7', description: 'Combine like terms and use the distributive property.', prereqs: ['6.expr.evaluate'] },
  { id: '7.eq.onestep', name: 'One-step equations', track: 'Algebra', grade_band: '6-7', description: 'Solve equations that need a single inverse operation.', prereqs: ['6.expr.evaluate'] },
  { id: '7.eq.twostep', name: 'Two-step equations', track: 'Algebra', grade_band: '7', description: 'Undo two operations to find the unknown.', prereqs: ['7.eq.onestep'] },
];

const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

/** SkillPrereq rows: { skill_id, prereq_id }. */
const SKILL_PREREQS = SKILLS.flatMap((s) => s.prereqs.map((p) => ({ skill_id: s.id, prereq_id: p })));

function getSkill(id) {
  return SKILL_BY_ID.get(id) || null;
}

/** Every skill that must be learned before `skillId` (transitive). */
function allPrereqs(skillId) {
  const seen = new Set();
  const walk = (id) => {
    for (const p of (SKILL_BY_ID.get(id) || { prereqs: [] }).prereqs) {
      if (!seen.has(p)) {
        seen.add(p);
        walk(p);
      }
    }
  };
  walk(skillId);
  return seen;
}

module.exports = { SKILLS, SKILL_PREREQS, getSkill, allPrereqs };
