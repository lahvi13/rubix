/**
 * The scramble a drill hands you: the case, met at a random angle.
 *
 * A drill scramble is not a random-state scramble — it has to produce one
 * particular case — so cubing.js has nothing to do here. The case's own setup
 * is enough; what this adds is the part that makes drilling a case different
 * from reading it off a card.
 */

import { formatAlg, parseAlg, type Move } from '../cube/notation';
import { applyAlg, solvedState, type CubeState } from '../cube/state';
import type { Random } from '../../lib/random';
import { pickFrom } from './selection';

/**
 * Turning the whole cube before the setup changes which colours end up where
 * and nothing else — the case is the same case, met with a different face in
 * front. Only y rotations: x and z would take yellow off the top, and every
 * last-layer set is learned, drawn and solved with it up there.
 */
export const DRILL_ROTATIONS = ['', 'y', 'y2', "y'"] as const;

/**
 * The U turn after the setup. Cases are named up to AUF — the same T perm is
 * the T perm from all four sides — so this keeps the case and moves the angle
 * it is recognised from, which is half of what drilling is for. It also means
 * the algorithm on the card needs your own AUF in front of it.
 */
export const DRILL_AUFS = ['', 'U', 'U2', "U'"] as const;

export interface DrillScramble {
  /** What the user performs, in the app's one spelling of every move. */
  text: string;
  moves: Move[];
  /** The cube after performing it from solved — what a preview draws. */
  state: CubeState;
  /** The two choices that were made, kept for tests and for the case sheet. */
  rotation: string;
  auf: string;
}

/**
 * Builds a scramble for one case. Draws the rotation first and the AUF second,
 * so a test can hand it a fixed sequence and know what it will get.
 *
 * Returns null when the setup does not parse: a custom case is whatever the
 * user typed, and a drill that silently ran on a solved cube would be worse
 * than one that says it cannot.
 */
export function drillScramble(setupAlg: string, random: Random): DrillScramble | null {
  const setup = parseAlg(setupAlg);
  if (!setup.ok) return null;

  const rotation = pickFrom(DRILL_ROTATIONS, random) ?? '';
  const auf = pickFrom(DRILL_AUFS, random) ?? '';

  const parsed = parseAlg([rotation, formatAlg(setup.moves), auf].join(' '));
  // The parts are already known to parse; this is only reassembling them.
  if (!parsed.ok) return null;

  return {
    text: formatAlg(parsed.moves),
    moves: parsed.moves,
    state: applyAlg(solvedState(), parsed.moves),
    rotation,
    auf,
  };
}
