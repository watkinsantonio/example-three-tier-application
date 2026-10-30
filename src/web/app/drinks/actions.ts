'use server';

import { revalidatePath } from 'next/cache';
import { parseDrinkName, parseScore } from './logic';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export type Drink = {
  id: number;
  name: string;
  rating_count: number;
  /** Average of all scores rounded to one decimal, or null when nobody has rated it. */
  average_rating: number | null;
  created_at: string;
};

export async function getDrinks(): Promise<Drink[]> {
  const res = await fetch(`${API_URL}/drinks`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch drinks');
  return res.json();
}

/** Adds a drink. Invalid names and duplicates are ignored; the list simply does not change. */
export async function createDrink(formData: FormData) {
  const parsed = parseDrinkName(formData.get('name'));
  if ('error' in parsed) return;

  await fetch(`${API_URL}/drinks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: parsed.value }),
  });
  revalidatePath('/drinks');
}

/** Records one rating (1-5) for a drink. Invalid scores are ignored. */
export async function rateDrink(drinkId: number, formData: FormData) {
  const score = parseScore(formData.get('score'));
  if (score === null) return;

  await fetch(`${API_URL}/drinks/${drinkId}/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score }),
  });
  revalidatePath('/drinks');
}
