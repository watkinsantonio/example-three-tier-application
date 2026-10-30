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

/** Validate a non-negative kilogram amount from a form. */
export function parseKg(input: unknown): { value: number } | { error: string } {
  const kg = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
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
  const regions: Region[] = [];
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
    const give = Math.min(region.needKg, fairShare);
    allocated[index] = give;
    remainingSupply -= give;
  });

  return regions.map((region, index) => ({
    ...region,
    allocatedKg: allocated[index],
    coveragePercent: coverage(allocated[index], region.needKg),
  }));
}

/** Percentage of `needKg` covered by `allocatedKg`, rounded down, 0-100. */
export function coverage(allocatedKg: number, needKg: number): number {
  if (needKg <= 0) return 100;
  return Math.min(100, Math.floor((allocatedKg / needKg) * 100));
}

/** Kilograms with thousands separators and at most one decimal, e.g. "1,200.5 kg". */
export function formatKg(kg: number): string {
  return `${kg.toLocaleString('en-US', { maximumFractionDigits: 1 })} kg`;
}
