import type { Metadata } from 'next';
import Link from 'next/link';
import { allocate, formatKg, parseKg, parseRegions, summarize } from './logic';

export const metadata: Metadata = {
  title: 'Food Distribution Planner',
};

const EXAMPLE_REGIONS = 'Northern District, 1200\nRiver Delta, 800\nMountain Villages, 300';

type SearchParams = Promise<{ supply?: string; regions?: string }>;

export default async function ImpactPage({ searchParams }: { searchParams: SearchParams }) {
  const { supply = '', regions: regionsText = '' } = await searchParams;
  const submitted = supply !== '' || regionsText !== '';

  let result: ReturnType<typeof allocate> | null = null;
  let supplyKg = 0;
  let error: string | null = null;
  if (submitted) {
    const parsedSupply = parseKg(supply);
    const parsedRegions = parseRegions(regionsText);
    if ('error' in parsedSupply) error = parsedSupply.error;
    else if ('error' in parsedRegions) error = parsedRegions.error;
    else {
      supplyKg = parsedSupply.value;
      result = allocate(supplyKg, parsedRegions.regions);
    }
  }

  const summary = result ? summarize(supplyKg, result) : null;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-16 px-4">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">
          ← Back to To-Do List
        </Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-4 mb-2">
          Food Distribution Planner
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
          A planning aid, not a solution: it only divides the food you enter across the regions you list.
          Enter the food available and each region&apos;s need. Supply is shared out fairly: every region
          gets an equal share, capped at its need, and any surplus goes to regions that still have a gap.
        </p>

        <form method="get" className="space-y-4 mb-8">
          <label className="block">
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Food available (kg)
            </span>
            <input
              name="supply"
              type="text"
              inputMode="decimal"
              pattern="\d+(\.\d+)?"
              title="Plain number of kg, e.g. 2500 or 2500.5"
              autoComplete="off"
              required
              defaultValue={supply}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Regions: one per line as &quot;Name, need in kg&quot;
            </span>
            <textarea
              name="regions"
              rows={6}
              required
              defaultValue={regionsText || EXAMPLE_REGIONS}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 font-mono text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 dark:bg-zinc-50 px-5 py-2 font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
          >
            Plan distribution
          </button>
        </form>

        {error && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {result && summary && (
          <section aria-label="Distribution plan">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Distributing {formatKg(summary.totalSupplied)} of {formatKg(summary.totalNeed)} total need.
            </p>
            <p className="text-sm mb-4" role="status">
              {summary.status === 'surplus' && (
                <span className="text-zinc-700 dark:text-zinc-300">{formatKg(summary.leftover)} left over after every need is met.</span>
              )}
              {summary.status === 'short' && (
                <span className="text-amber-600 dark:text-amber-400">
                  Short by {formatKg(summary.unmet)}: supply does not cover all needs.
                </span>
              )}
              {summary.status === 'exact' && (
                <span className="text-zinc-700 dark:text-zinc-300">Supply matches need exactly.</span>
              )}
            </p>
            <ul className="space-y-3">
              {result.map((region, index) => (
                <li
                  key={index}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{region.name}</span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {region.coveragePercent}% covered
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {formatKg(region.allocatedKg)} of {formatKg(region.needKg)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
