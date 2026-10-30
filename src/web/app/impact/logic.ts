/**
 * Food-distribution planning for the /impact page. Pure functions only.
 *
 * Allocation uses max-min fairness: every region receives an equal share of the
 * supply, capped at its own need. Regions with small needs are fully covered
 * first and any surplus they leave behind is shared by the rest. Nobody gets
 * more than they need while someone with a larger need gets less.
 */

export interface Region {
  name: string;
  needKg: number;
}

export interface Allocation extends Region {
  allocatedKg: number;
  /** Share of the need that is covered, 0-100 (100 when the need is zero). */
  coveragePercent: number;
}

export const MAX_REGIONS = 50;
export const MAX_REGION_NAME_LENGTH = 60;
/** Upper bound on the raw regions text, checked before any splitting. */
export const MAX_REGIONS_TEXT_LENGTH = 5000;
/**
 * Relative float tolerance for kg arithmetic. Amounts within this fraction of
 * the larger magnitude (and at least this absolute size) are treated as equal,
 * so the tolerance scales with the amounts being compared.
 */
const KG_RELATIVE_EPSILON = 1e-12;
/** Longest accepted text for one kg amount, checked before parsing. */
const MAX_KG_TEXT_LENGTH = 20;

/** True when two kg amounts differ only by float noise at their scale. */
export function kgNear(a: number, b: number): boolean {
  return Math.abs(a - b) <= KG_RELATIVE_EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Validate a non-negative kilogram amount: plain decimal digits only (no hex, exponents or signs). */
export function parseKg(input: unknown): { value: number } | { error: string } {
  const text = typeof input === 'string' ? input.trim() : input;
  if (typeof text === 'string' && text.length > MAX_KG_TEXT_LENGTH) {
    return { error: 'Enter an amount of 0 kg or more.' };
  }
  const kg = typeof text === 'string' && /^\d+(\.\d+)?$/.test(text) ? Number(text) : input;
  if (typeof kg !== 'number' || !Number.isFinite(kg) || kg < 0) {
    return { error: 'Enter an amount of 0 kg or more.' };
  }
  return { value: kg };
}

/**
 * Parse one region per line, written as "Name, need in kg", e.g.
 * "Northern District, 1200". Blank lines are ignored.
 */
export function parseRegions(text: string): { regions: Region[] } | { error: string } {
  if (text.length > MAX_REGIONS_TEXT_LENGTH) {
    return { error: `The region list is too long. Plan at most ${MAX_REGIONS} regions at a time.` };
  }
  const regions: Region[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    const comma = line.lastIndexOf(',');
    if (comma === -1) {
      return { error: `Line ${index + 1}: use the format "Name, need in kg".` };
    }
    const name = line.slice(0, comma).trim();
    if (!name || name.length > MAX_REGION_NAME_LENGTH) {
      return { error: `Line ${index + 1}: region names must be 1-${MAX_REGION_NAME_LENGTH} characters.` };
    }
    const need = parseKg(line.slice(comma + 1).trim());
    if ('error' in need) {
      return { error: `Line ${index + 1}: ${need.error}` };
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      return { error: `Line ${index + 1}: region "${name}" is listed more than once.` };
    }
    seen.add(key);
    regions.push({ name, needKg: need.value });
  }
  if (regions.length === 0) {
    return { error: 'Add at least one region.' };
  }
  if (regions.length > MAX_REGIONS) {
    return { error: `Plan at most ${MAX_REGIONS} regions at a time.` };
  }
  return { regions };
}

/**
 * Split `supplyKg` across `regions` with max-min fairness. Returns allocations
 * in the same order as the input. The total allocated never exceeds the supply
 * and never exceeds the total need.
 */
export function allocate(supplyKg: number, regions: Region[]): Allocation[] {
  const order = regions
    .map((region, index) => ({ region, index }))
    .sort((a, b) => a.region.needKg - b.region.needKg || a.index - b.index);

  const allocated = new Array<number>(regions.length).fill(0);
  let remainingSupply = Math.max(0, supplyKg);

  order.forEach(({ region, index }, position) => {
    const regionsLeft = order.length - position;
    const fairShare = remainingSupply / regionsLeft;
    // Snap to the full need when the share is within float noise of it, so exact matches stay exact.
    const give =
      fairShare >= region.needKg || kgNear(fairShare, region.needKg) ? region.needKg : fairShare;
    allocated[index] = give;
    remainingSupply = Math.max(0, remainingSupply - give);
  });

  return regions.map((region, index) => ({
    ...region,
    allocatedKg: allocated[index],
    coveragePercent: coverage(allocated[index], region.needKg),
  }));
}

/** Food left unallocated after distribution, snapped to 0 within float noise. Never negative. */
export function leftoverKg(supplyKg: number, allocations: Allocation[]): number {
  const allocated = allocations.reduce((sum, a) => sum + a.allocatedKg, 0);
  if (kgNear(supplyKg, allocated)) return 0;
  return Math.max(0, supplyKg - allocated);
}

/** Need that could not be covered: total need minus total allocated, snapped to 0 within float noise. */
export function unmetKg(allocations: Allocation[]): number {
  const need = allocations.reduce((sum, a) => sum + a.needKg, 0);
  const allocated = allocations.reduce((sum, a) => sum + a.allocatedKg, 0);
  if (kgNear(need, allocated)) return 0;
  return Math.max(0, need - allocated);
}

/**
 * Percentage of `needKg` covered by `allocatedKg`, rounded down, 0-100.
 * Only an amount that meets the need (or matches it within float noise) reports 100;
 * a real shortfall never rounds up to 100.
 */
export function coverage(allocatedKg: number, needKg: number): number {
  if (needKg <= 0) return 100;
  if (allocatedKg >= needKg || kgNear(allocatedKg, needKg)) return 100;
  return Math.min(99, Math.floor((allocatedKg / needKg) * 100));
}

export interface PlanSummary {
  totalSupplied: number;
  totalNeed: number;
  leftover: number;
  unmet: number;
  /** "exact" when supply matches need, "surplus" when food is left over, "short" when needs are unmet. */
  status: 'exact' | 'surplus' | 'short';
}

/** Totals and the headline status for a finished allocation. */
export function summarize(supplyKg: number, allocations: Allocation[]): PlanSummary {
  const leftover = leftoverKg(supplyKg, allocations);
  const unmet = unmetKg(allocations);
  let status: PlanSummary['status'] = 'exact';
  if (unmet > 0) status = 'short';
  else if (leftover > 0) status = 'surplus';
  return {
    totalSupplied: allocations.reduce((sum, a) => sum + a.allocatedKg, 0),
    totalNeed: allocations.reduce((sum, a) => sum + a.needKg, 0),
    leftover,
    unmet,
    status,
  };
}

/** Kilograms with thousands separators and at most one decimal, e.g. "1,200.5 kg". */
export function formatKg(kg: number): string {
  return `${kg.toLocaleString('en-US', { maximumFractionDigits: 1 })} kg`;
}
