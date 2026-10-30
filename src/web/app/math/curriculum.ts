import { createRng } from './rng.ts';
import { SKILL_PREREQS, SKILLS } from './skills.ts';
import { ALGEBRA_TEMPLATES } from './templates-algebra.ts';
import { FRACTION_TEMPLATES } from './templates-fractions.ts';
import { NUMBER_TEMPLATES } from './templates-number.ts';
import type { ProblemInstance, ProblemTemplate, Skill } from './types.ts';

export { SKILLS, SKILL_PREREQS };

export const TEMPLATES: ProblemTemplate[] = [...NUMBER_TEMPLATES, ...FRACTION_TEMPLATES, ...ALGEBRA_TEMPLATES];

const skillById = new Map(SKILLS.map((s) => [s.id, s]));
const templateById = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getSkill(id: string): Skill | undefined {
  return skillById.get(id);
}

export function getTemplate(id: string): ProblemTemplate | undefined {
  return templateById.get(id);
}

/** Templates for a skill, easiest first. */
export function templatesForSkill(skillId: string): ProblemTemplate[] {
  return TEMPLATES.filter((t) => t.skill_id === skillId).sort((a, b) => a.difficulty - b.difficulty);
}

export function prereqsOf(skillId: string): string[] {
  return SKILL_PREREQS.filter((p) => p.skill_id === skillId).map((p) => p.prereq_id);
}

export function dependentsOf(skillId: string): string[] {
  return SKILL_PREREQS.filter((p) => p.prereq_id === skillId).map((p) => p.skill_id);
}

/** Skills ordered so every skill comes after its prerequisites. Throws if the graph has a cycle. */
export function topologicalSkills(): Skill[] {
  const done = new Set<string>();
  const out: Skill[] = [];
  const remaining = [...SKILLS];
  while (remaining.length) {
    const before = remaining.length;
    for (let i = 0; i < remaining.length; ) {
      const s = remaining[i];
      if (prereqsOf(s.id).every((p) => done.has(p))) {
        out.push(s);
        done.add(s.id);
        remaining.splice(i, 1);
      } else {
        i++;
      }
    }
    if (remaining.length === before) throw new Error('Skill prerequisites contain a cycle');
  }
  return out;
}

/** Deterministically build a problem from a template and seed. */
export function buildProblem(templateId: string, seed: number): ProblemInstance {
  const template = templateById.get(templateId);
  if (!template) throw new Error(`Unknown template ${templateId}`);
  const generated = template.generator(createRng(seed));
  return {
    ...generated,
    template_id: template.id,
    skill_id: template.skill_id,
    type: template.type,
    difficulty: template.difficulty,
    seed,
  };
}
