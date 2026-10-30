import type { Metadata } from 'next';
import Link from 'next/link';
import { createDrink, getDrinks, rateDrink } from './actions';
import { MAX_DRINK_NAME_LENGTH, formatRating, starsFor } from './logic';

export const metadata: Metadata = {
  title: 'Drink Ratings',
};

export default async function DrinksPage() {
  const drinks = await getDrinks();

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-16 px-4">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline">
          ← Back to To-Do List
        </Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mt-4 mb-8">
          Drink Ratings
        </h1>

        {/* Add drink form */}
        <form action={createDrink} className="flex gap-2 mb-8">
          <input
            name="name"
            type="text"
            required
            maxLength={MAX_DRINK_NAME_LENGTH}
            placeholder="Add a drink..."
            aria-label="Drink name"
            className="flex-1 min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 dark:bg-zinc-50 px-5 py-2 font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
          >
            Add
          </button>
        </form>

        {/* Drink list, best rated first */}
        <ul className="space-y-3">
          {drinks.length === 0 && (
            <li className="text-zinc-400 text-center py-8">No drinks yet. Add your favorite above!</li>
          )}
          {drinks.map((drink) => (
            <li
              key={drink.id}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{drink.name}</span>
                <span className="text-amber-500 whitespace-nowrap" aria-hidden="true">
                  {starsFor(drink.average_rating)}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {formatRating(drink.average_rating, drink.rating_count)}
              </p>

              <form action={rateDrink.bind(null, drink.id)} className="flex items-center gap-2 mt-3">
                <label htmlFor={`score-${drink.id}`} className="text-sm text-zinc-600 dark:text-zinc-400">
                  Your rating
                </label>
                <select
                  id={`score-${drink.id}`}
                  name="score"
                  defaultValue="5"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                >
                  {[5, 4, 3, 2, 1].map((score) => (
                    <option key={score} value={score}>
                      {score} {score === 1 ? 'star' : 'stars'}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1 text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  Rate
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
