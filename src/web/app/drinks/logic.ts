export const MAX_DRINK_NAME_LENGTH = 100;

/** Validate a drink name from a form. Returns the trimmed name or an error message. */
export function parseDrinkName(input: unknown): { value: string } | { error: string } {
  if (typeof input !== 'string' || !input.trim()) {
    return { error: 'Enter a drink name.' };
  }
  const value = input.trim();
  if (value.length > MAX_DRINK_NAME_LENGTH) {
    return { error: `Drink names must be ${MAX_DRINK_NAME_LENGTH} characters or fewer.` };
  }
  return { value };
}

/** Parse a rating score from a form. Only whole numbers 1-5 are valid. */
export function parseScore(input: unknown): number | null {
  const score = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
  return typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5
    ? score
    : null;
}

/** Human-readable summary, e.g. "4.5 / 5 from 2 ratings" or "No ratings yet". */
export function formatRating(average: number | null, count: number): string {
  if (count === 0 || average === null) return 'No ratings yet';
  const noun = count === 1 ? 'rating' : 'ratings';
  return `${average.toFixed(1)} / 5 from ${count} ${noun}`;
}

/** Stars for a rounded average, e.g. 3.6 -> "★★★★☆" (filled stars round to the nearest whole star). */
export function starsFor(average: number | null): string {
  const filled = average === null ? 0 : Math.min(5, Math.max(0, Math.round(average)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}
