/**
 * A scramble passed on as a link, to be opened straight onto somebody else's
 * timer — with the time it was done in, for them to beat.
 *
 * Everything rides in the hash, which a browser never sends: the site serves
 * the same page whatever scramble is in the link, and never sees one.
 */

import { formatAlg, formatMove, parseAlg } from '../cube/notation';

export interface SharedScramble {
  /** Written the app's own way, whatever the link spelled it as. */
  scramble: string;
  /** The final time to beat; null when there is none — the solve was a DNF. */
  targetMs: number | null;
}

/** Longer than any scramble drawn for any puzzle here, and a cap on what a link can make the app parse. */
const MAX_MOVES = 100;
/** A day. A longer target is not a time anybody is going to beat. */
const MAX_TARGET_MS = 24 * 60 * 60 * 1000;

/**
 * The moves go in as `R_U-_F2` — spaces and primes are what a messenger's
 * link detection stops at, and percent-escapes make the link unreadable to
 * anybody deciding whether to tap it. The spelling is alg.cubing.net's.
 *
 * Null when the scramble is not one the app can read back.
 */
export function shareLinkFor(origin: string, shared: SharedScramble): string | null {
  const parsed = parseAlg(shared.scramble);
  if (!parsed.ok || parsed.moves.length === 0 || parsed.moves.length > MAX_MOVES) return null;

  const moves = parsed.moves.map((move) => formatMove(move).replace("'", '-')).join('_');
  const beat = shared.targetMs === null ? '' : `&beat=${shared.targetMs}`;
  return `${origin}/#/timer?scramble=${moves}${beat}`;
}

/**
 * The scramble a location's hash carries, or null when it carries none. The
 * link came from outside, so nothing in it is taken on trust: a scramble that
 * does not parse is no scramble, and a target that is not a whole, sensible
 * number of milliseconds is dropped while the scramble is kept.
 */
export function readShareLink(hash: string): SharedScramble | null {
  const match = /^#\/?timer\?(.*)$/.exec(hash);
  if (match === null) return null;
  const params = new URLSearchParams(match[1]);

  // Spaces and primes are read too: a link retyped by hand, or re-escaped on
  // the way, is still the same scramble.
  const text = (params.get('scramble') ?? '').replace(/_/g, ' ').replace(/-/g, "'");
  const parsed = parseAlg(text);
  if (!parsed.ok || parsed.moves.length === 0 || parsed.moves.length > MAX_MOVES) return null;

  const beat = params.get('beat') ?? '';
  const targetMs = /^\d{1,8}$/.test(beat) ? Number(beat) : null;

  return {
    scramble: formatAlg(parsed.moves),
    targetMs: targetMs !== null && targetMs > 0 && targetMs <= MAX_TARGET_MS ? targetMs : null,
  };
}
