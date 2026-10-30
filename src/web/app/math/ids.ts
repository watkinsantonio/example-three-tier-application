// Small helpers for the browser UI. Call these from event handlers and effects, never during render.

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A fresh non-negative 31-bit seed for generating a problem. */
export function newSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function percent(p: number): string {
  return `${Math.round(Math.min(1, Math.max(0, p)) * 100)}%`;
}
