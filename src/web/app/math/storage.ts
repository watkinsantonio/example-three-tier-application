import { emptyState } from './engine.ts';
import { STORE_VERSION, type MathState } from './types.ts';

export const STORAGE_KEY = 'mathpath.v1';
export const BACKUP_KEY = 'mathpath.v1.unreadable';

export type LoadStatus = 'ok' | 'empty' | 'corrupt' | 'newer';

export interface LoadResult {
  state: MathState;
  status: LoadStatus;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function arrayOfRecords(v: unknown, requiredStrings: string[]): boolean {
  return (
    Array.isArray(v) &&
    v.every((item) => isRecord(item) && requiredStrings.every((k) => typeof item[k] === 'string'))
  );
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
  const ok =
    data.version === STORE_VERSION &&
    arrayOfRecords(data.guardians, ['id', 'name']) &&
    arrayOfRecords(data.learners, ['id', 'display_name', 'created_at']) &&
    arrayOfRecords(data.attempts, ['id', 'learner_id', 'skill_id', 'template_id']) &&
    arrayOfRecords(data.masteries, ['learner_id', 'skill_id', 'status']) &&
    arrayOfRecords(data.placements, ['id', 'learner_id', 'started_at']) &&
    (data.placements as Record<string, unknown>[]).every((p) => Array.isArray(p.answers) && Array.isArray(p.result_skill_ids));
  if (!ok) return { state: emptyState(), status: 'corrupt' };
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
    return { state: emptyState(), status: 'empty' };
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
