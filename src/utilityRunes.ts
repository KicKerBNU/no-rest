import { createRequire } from 'node:module';
import type { UtilityRune } from './types.js';

const require = createRequire(import.meta.url);
const runeData = require('../data/utility-runes.json') as UtilityRune[];

const runes: UtilityRune[] = runeData;

/**
 * Returns every utility rune, optionally filtered by a search query.
 */
export function getUtilityRunes(query?: string): UtilityRune[] {
  if (!query) {
    return runes;
  }

  const normalized = query.trim().toLowerCase();
  return runes.filter((rune) =>
    rune.name.toLowerCase().includes(normalized) ||
    rune.category.toLowerCase().includes(normalized)
  );
}

/**
 * Finds a rune by exact (case-insensitive) name.
 */
export function findUtilityRune(name: string): UtilityRune | undefined {
  const normalized = name.trim().toLowerCase();
  return runes.find((rune) => rune.name.toLowerCase() === normalized);
}
