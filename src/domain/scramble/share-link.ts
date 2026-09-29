/**
 * Scrambles passed on as a link, to be opened straight onto somebody else's
 * timer — with the time they were done in, for them to beat. One scramble and
 * a single, or a whole window of them and the average they made.
 *
 * Everything rides in the hash, which a browser never sends: the site serves
 * the same page whatever scramble is in the link, and never sees one.
 */

import { formatAlg, formatMove, parseAlg } from '../cube/notation';

export interface SharedScrambles {
  /**
   * In the order they are to be solved, written the app's own way whatever
   * the link spelled them as. One for a single; five or twelve for an average.
   */
  scrambles: string[];
  /**
   * The final time to beat — the single, or the average over all of them.
   * Null when there is none: the single was a DNF.
   */
  targetMs: number | null;
}

/** A single, an ao5, an ao12. Longer windows make a link nobody would tap. */
const SHAREABLE_COUNTS: readonly number[] = [1, 5, 12];
/** Longer than any scramble drawn for any puzzle here, and a cap on what a link can make the app parse. */
const MAX_MOVES = 100;
/** A day. A longer target is not a time anybody is going to beat. */
const MAX_TARGET_MS = 24 * 60 * 60 * 1000;

/**
 * The moves go in as `R_U-_F2` — spaces and primes are what a messenger's
 * link detection stops at, and percent-escapes make the link unreadable to
 * anybody deciding whether to tap it. The spelling is alg.cubing.net's. Each
 * scramble is a `scramble` parameter of its own, in order.
 *
 * Null when any scramble is not one the app can read back, or when there are
 * more or fewer of them than an average the app keeps.
 */
export function shareLinkFor(origin: string, shared: SharedScrambles): string | null {
  if (!SHAREABLE_COUNTS.includes(shared.scrambles.length)) return null;
  const params: string[] = [];
  for (const scramble of shared.scrambles) {
    const parsed = parseAlg(scramble);
    if (!parsed.ok || parsed.moves.length === 0 || parsed.moves.length > MAX_MOVES) return null;
    params.push(`scramble=${parsed.moves.map((move) => formatMove(move).replace("'", '-')).join('_')}`);
  }
  if (shared.targetMs !== null) params.push(`beat=${shared.targetMs}`);
  return `${origin}/#/timer?${params.join('&')}`;
}

/**
 * The scrambles a location's hash carries, or null when it carries none. The
 * link came from outside, so nothing in it is taken on trust: one scramble
 * that does not parse spoils the set, and a target that is not a whole,
 * sensible number of milliseconds is dropped while the scrambles are kept.
 */
export function readShareLink(hash: string): SharedScrambles | null {
  const match = /^#\/?timer\?(.*)$/.exec(hash);
  if (match === null) return null;
  const params = new URLSearchParams(match[1]);

  const texts = params.getAll('scramble');
  if (!SHAREABLE_COUNTS.includes(texts.length)) return null;
  const scrambles: string[] = [];
  for (const text of texts) {
    // Spaces and primes are read too: a link retyped by hand, or re-escaped
    // on the way, is still the same scramble.
    const parsed = parseAlg(text.replace(/_/g, ' ').replace(/-/g, "'"));
    if (!parsed.ok || parsed.moves.length === 0 || parsed.moves.length > MAX_MOVES) return null;
    scrambles.push(formatAlg(parsed.moves));
  }

  const beat = params.get('beat') ?? '';
  const targetMs = /^\d{1,8}$/.test(beat) ? Number(beat) : null;

  return {
    scrambles,
    targetMs: targetMs !== null && targetMs > 0 && targetMs <= MAX_TARGET_MS ? targetMs : null,
  };
}
