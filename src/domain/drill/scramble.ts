/**
 * The scramble a drill hands you: the case, met at a random angle.
 *
 * The setup built here is the case itself, and it is not what the user is
 * asked to perform. A setup is the inverse of an algorithm, so anyone who
 * reads it backwards has the answer before the clock starts. The drill hands
 * the `target` to a solver instead (scramble-client.ts) and shows the inverse
 * of whatever that finds: the same case, reached by moves that have nothing
 * to do with the algorithm being drilled. The setup text is kept as the
 * fallback for when the solver cannot be reached, and for recognition, which
 * only draws the cube.
 */

import { formatAlg, invertAlg, parseAlg, type Move } from '../cube/notation';
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
  /**
   * The same case with the centres left where they started: the rotation is
   * undone after the setup instead of being left on the cube. A solver
   * scrambles with face turns only, so this is the state it can be asked for;
   * the pieces sit around the centres exactly as `state` has them.
   */
  target: string;
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
  const turn = parseAlg(rotation);
  // The parts are already known to parse; this is only reassembling them.
  if (!parsed.ok || !turn.ok) return null;

  // An AUF commutes with a y rotation, so undoing the rotation at the very
  // end is the same as undoing it straight after the setup.
  const target = [...parsed.moves, ...invertAlg(turn.moves)];

  return {
    text: formatAlg(parsed.moves),
    moves: parsed.moves,
    state: applyAlg(solvedState(), parsed.moves),
    rotation,
    auf,
    target: formatAlg(target),
  };
}
