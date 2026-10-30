import { emptyState } from './engine.ts';
import { STORE_VERSION, type MathState } from './types.ts';

export const STORAGE_KEY = 'mathpath.v1';
export const BACKUP_KEY = 'mathpath.v1.unreadable';

export type LoadStatus = 'ok' | 'empty' | 'corrupt' | 'newer' | 'unavailable';

export interface LoadResult {
  state: MathState;
  status: LoadStatus;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

type Check = (v: unknown) => boolean;

const isString: Check = (v) => typeof v === 'string';
const isDate: Check = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const isCount: Check = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isProbability: Check = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const isBool: Check = (v) => typeof v === 'boolean';
const isStringArray: Check = (v) => Array.isArray(v) && v.every(isString);
const nullable = (check: Check): Check => (v) => v === null || check(v);
const oneOf = (...values: string[]): Check => (v) => typeof v === 'string' && values.includes(v);
const isParams: Check = (v) =>
  isRecord(v) && Object.values(v).every((x) => typeof x === 'string' || (typeof x === 'number' && Number.isFinite(x)));

/** Every listed field must pass its check; unknown extra fields are ignored. */
function arrayOf(v: unknown, fields: Record<string, Check>): boolean {
  return (
    Array.isArray(v) &&
    v.every((item) => isRecord(item) && Object.entries(fields).every(([key, check]) => check(item[key])))
  );
}

const SCHEMA = {
  guardians: { id: isString, name: isString },
  learners: {
    id: isString,
    display_name: isString,
    birth_year: isCount,
    guardian_id: nullable(isString),
    created_at: isDate,
  },
  attempts: {
    id: isString,
    learner_id: isString,
    skill_id: isString,
    template_id: isString,
    problem_instance: (v: unknown) => isRecord(v) && isCount(v.seed) && isParams(v.params),
    response: isString,
    is_correct: isBool,
    detected_misconception: nullable(isString),
    time_ms: isCount,
    hints_used: isCount,
    created_at: isDate,
  },
  masteries: {
    learner_id: isString,
    skill_id: isString,
    p_mastery: isProbability,
    streak: isCount,
    last_practiced_at: nullable(isDate),
    next_review_at: nullable(isDate),
    status: oneOf('locked', 'learning', 'mastered'),
  },
  placements: {
    id: isString,
    learner_id: isString,
    started_at: isDate,
    finished_at: nullable(isDate),
    result_skill_ids: isStringArray,
    answers: (v: unknown) =>
      arrayOf(v, { skill_id: isString, template_id: isString, seed: isCount, is_correct: isBool }),
  },
} satisfies Record<string, Record<string, Check>>;

/** Deep-check the shape of saved data so a damaged or hand-edited file cannot crash or poison the app. */
function isValidState(data: Record<string, unknown>): boolean {
  return (Object.keys(SCHEMA) as (keyof typeof SCHEMA)[]).every((key) => arrayOf(data[key], SCHEMA[key]));
}

/**
 * Parse saved data. A file written by a newer version of the app is refused (status "newer") and must not be
 * overwritten; anything unreadable is reported as "corrupt" so the caller can keep a backup copy.
 */
export function parseStored(raw: string | null): LoadResult {
  if (raw === null) return { state: emptyState(), status: 'empty' };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { state: emptyState(), status: 'corrupt' };
  }
  if (!isRecord(data) || typeof data.version !== 'number') return { state: emptyState(), status: 'corrupt' };
  if (data.version > STORE_VERSION) return { state: emptyState(), status: 'newer' };
  if (data.version !== STORE_VERSION || !isValidState(data)) return { state: emptyState(), status: 'corrupt' };
  return { state: data as unknown as MathState, status: 'ok' };
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadState(storage: KeyValueStorage): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    // Existing progress may be there but unreadable: never overwrite it.
    return { state: emptyState(), status: 'unavailable' };
  }
  const result = parseStored(raw);
  if (result.status === 'corrupt' && raw !== null) {
    try {
      storage.setItem(BACKUP_KEY, raw); // keep the unreadable data so nothing is lost silently
    } catch {
      // ignore: backup is best effort
    }
  }
  return result;
}

/** Returns an error message if the data could not be saved (private mode, storage full, ...). */
export function saveState(storage: KeyValueStorage, state: MathState): string | null {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return null;
  } catch {
    return 'Your progress could not be saved in this browser (storage may be full or disabled).';
  }
}
