/**
 * What the drill shows next. Pure choosing — no cube, no database: given a
 * pool of cases and a source of randomness, which one comes up.
 */

import type { Random } from '../../lib/random';

/** Everything picking needs to know about a case. */
export interface Identified {
  id: string;
}

/** One item of the list, chosen uniformly. Undefined only for an empty list. */
export function pickFrom<T>(items: readonly T[], random: Random): T | undefined {
  if (items.length === 0) return undefined;
  // random() is specified as < 1, but a source that returns exactly 1 would
  // otherwise index past the end.
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index];
}

/**
 * The list in a random order, without disturbing the caller's copy. Fisher-
 * Yates, walked from the end, so every ordering is equally likely — a sort
 * with a random comparator is not, and here it would quietly park the right
 * answer in the same corner of the grid too often.
 */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.min(index, Math.floor(random() * (index + 1)));
    const held = result[index];
    const other = result[swap];
    // Indices are in range by construction; this satisfies the checker.
    if (held === undefined || other === undefined) continue;
    result[index] = other;
    result[swap] = held;
  }
  return result;
}

/**
 * The case to drill next. Never the same one twice in a row while there is
 * anything else to pick: a repeat is the one case whose answer is still on
 * the screen, so drilling it measures memory of the last ten seconds.
 */
export function pickNextCase<T extends Identified>(
  pool: readonly T[],
  previousId: string | null,
  random: Random,
): T | null {
  const candidates =
    pool.length > 1 && previousId !== null
      ? pool.filter((entry) => entry.id !== previousId)
      : pool;
  return pickFrom(candidates.length === 0 ? pool : candidates, random) ?? null;
}

/**
 * The subset the user drills. An empty selection means the whole set rather
 * than nothing to drill — "none ticked" is how a fresh set arrives, and a
 * drill screen that then has nothing to show would just look broken.
 */
export function drillPool<T extends Identified>(
  cases: readonly T[],
  selectedIds: readonly string[] | null,
): T[] {
  if (selectedIds === null || selectedIds.length === 0) return [...cases];

  const wanted = new Set(selectedIds);
  const selected = cases.filter((entry) => wanted.has(entry.id));
  // A selection that matches nothing (cases deleted since it was made) falls
  // back to the set, for the same reason.
  return selected.length === 0 ? [...cases] : selected;
}
