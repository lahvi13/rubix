/**
 * One round of case recognition: which case to show, and which cases to offer
 * as the answer.
 *
 * Pure choosing, like the drill's own selection — no cube, no database. What
 * makes a round hard is entirely in here: the cases offered alongside the
 * right one. Six cards drawn at random from a set of 57 are six cards you can
 * tell apart at a glance, and a trainer you can pass without looking at the
 * cube trains nothing, so the ones from the same shape family come first.
 */

import type { Random } from '../../lib/random';
import { pickNextCase, shuffle, type Identified } from '../drill/selection';

/** Everything building a round needs to know about a case. */
export interface RecognitionCase extends Identified {
  /** Cases of a shape family are the ones worth confusing with each other. */
  group: string | null;
}

/** How many cards a round offers. Three columns of two on a phone. */
export const OPTION_COUNT = 6;

/** Below this there is no question to ask — one card is its own answer. */
export const MIN_POOL = 2;

export interface RecognitionRound {
  answerId: string;
  /** The cards, answer included, in the order they are laid out. */
  optionIds: string[];
}

/**
 * Builds a round out of the pool, avoiding the case that was just asked.
 * Returns null when there is nothing to ask — an empty pool, or one case.
 *
 * The cards come only from the pool, never from the wider set: the pool is
 * what the user said they were practising, and answers from outside it would
 * be cases they have not met.
 */
export function buildRound(
  pool: readonly RecognitionCase[],
  previousId: string | null,
  random: Random,
  optionCount: number = OPTION_COUNT,
): RecognitionRound | null {
  if (pool.length < MIN_POOL) return null;

  const answer = pickNextCase(pool, previousId, random);
  if (answer === null) return null;

  const others = pool.filter((entry) => entry.id !== answer.id);
  const family = shuffle(
    others.filter((entry) => entry.group !== null && entry.group === answer.group),
    random,
  );
  const rest = shuffle(
    others.filter((entry) => entry.group === null || entry.group !== answer.group),
    random,
  );

  const distractors = [...family, ...rest].slice(0, Math.max(1, optionCount - 1));
  return {
    answerId: answer.id,
    optionIds: shuffle([answer, ...distractors], random).map((entry) => entry.id),
  };
}
