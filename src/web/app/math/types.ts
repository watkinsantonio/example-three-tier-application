// Data model for the MathPath practice app (/math). Runs entirely in the browser; state is persisted in localStorage.

export type ProblemType = 'numeric' | 'multiple_choice' | 'drag' | 'fraction' | 'expression';
export type MasteryStatus = 'locked' | 'learning' | 'mastered';
export type Params = Record<string, number | string>;

export interface Skill {
  id: string; // e.g. "3.mult.facts"
  name: string;
  track: string;
  grade_band: string;
  description: string;
}

export interface SkillPrereq {
  skill_id: string;
  prereq_id: string;
}

/** What a template's generator returns for one seed. */
export interface GeneratedProblem {
  prompt: string;
  /** Canonical correct answer: a number, "n/d", a choice text, an expression, or items joined with "|" (drag). */
  answer: string;
  params: Params;
  /** multiple_choice: the shuffled options. drag: the items in their starting (shuffled) order. */
  choices?: string[];
}

/** A wrong-answer pattern, e.g. "added denominators". */
export interface MisconceptionCheck {
  id: string;
  description: string;
  /** Shown to the learner when the pattern is detected. */
  feedback: string;
  detect: (response: string, params: Params) => boolean;
}

export interface ProblemTemplate {
  id: string;
  skill_id: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  type: ProblemType;
  generator: (rng: () => number) => GeneratedProblem;
  hint_steps: (params: Params) => string[];
  explanation: (params: Params, answer: string) => string;
  misconception_checks: MisconceptionCheck[];
}

/** A generated problem, fully reproducible from template_id + seed. */
export interface ProblemInstance extends GeneratedProblem {
  template_id: string;
  skill_id: string;
  type: ProblemType;
  difficulty: number;
  seed: number;
}

export interface Guardian {
  id: string;
  name: string;
}

export interface Learner {
  id: string;
  display_name: string;
  birth_year: number;
  guardian_id: string | null; // required when the learner is 13 or younger (by birth year)
  created_at: string;
}

export interface Attempt {
  id: string;
  learner_id: string;
  skill_id: string;
  template_id: string;
  problem_instance: { seed: number; params: Params };
  response: string;
  is_correct: boolean;
  detected_misconception: string | null;
  time_ms: number;
  hints_used: number;
  created_at: string;
}

export interface SkillMastery {
  learner_id: string;
  skill_id: string;
  p_mastery: number; // 0-1
  streak: number;
  last_practiced_at: string | null;
  next_review_at: string | null;
  status: MasteryStatus;
}

export interface PlacementAnswer {
  skill_id: string;
  template_id: string;
  seed: number;
  is_correct: boolean;
}

export interface PlacementSession {
  id: string;
  learner_id: string;
  started_at: string;
  finished_at: string | null;
  result_skill_ids: string[];
  answers: PlacementAnswer[];
}

export const STORE_VERSION = 1;

export interface MathState {
  version: number;
  guardians: Guardian[];
  learners: Learner[];
  attempts: Attempt[];
  masteries: SkillMastery[];
  placements: PlacementSession[];
}
