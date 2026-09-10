/**
 * The scramble the cross is drilled from: turns of a cube, and nothing more
 * clever than that.
 *
 * Not a random-state scramble. The drill starts from a solved cross rather
 * than a solved cube, and the only thing it needs randomised is where the four
 * cross edges have got to — which a plain walk does, given enough of it.
 *
 * How much is enough was measured rather than guessed. Over 20,000 walks, the
 * length of the shortest cross that comes out settles towards the distribution
 * of a thoroughly mixed cube like this:
 *
 *     moves | crosses of 4 or fewer | mean cross
 *         8 |                  27 % |       4.98
 *        12 |                  12 % |       5.51
 *        16 |                 8.5 % |       5.68
 *        20 |                 6.2 % |       5.75
 *   mixed   |                 6.2 % |       5.81
 *
 * A short walk does not make the cross random, it makes it easy: at twelve
 * moves you are handed a four-move cross twice as often as you should be.
 * Sixteen is where that bias stops being worth the four extra turns — it is
 * within a percentage point of a mixed cube on the cases that matter, and a
 * third shorter than the scramble the timer gives out.
 *
 * Going shorter than this needs a different idea altogether: draw the cross
 * state itself and find a path of fixed length to it. Drawing one and using
 * the reverse of its solution would be shorter still and perfectly fair, and
 * also useless — the number of moves you were told to perform would announce
 * the length of the answer before you had looked at the cube.
 */

import { parseAlg, type Face, type Move } from '../cube/notation';
import { applyAlg, solvedState, type CubeState } from '../cube/state';
import type { Random } from '../../lib/random';
import { pickFrom } from './selection';

/** See the note above: measured, not chosen for looking round. */
export const CROSS_SCRAMBLE_LENGTH = 16;

const FACES: readonly Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
const SUFFIXES = ['', "'", '2'] as const;

/** Opposite faces turn independently, so two of them in a row is one turn. */
const AXIS: Record<Face, string> = { U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };

export interface CrossScramble {
  /** What the user performs, in the app's one spelling of every move. */
  text: string;
  moves: Move[];
  /** The cube after performing it, in the frame the drill holds it: cross down. */
  state: CubeState;
}

/**
 * A walk of `CROSS_SCRAMBLE_LENGTH` turns with the two redundancies left out:
 * the same face twice in a row is one turn written as two, and a third turn on
 * an axis already turned twice is the same. Neither changes what the walk can
 * reach; both waste a move out of the sixteen.
 *
 * Each turn is drawn from the faces that are still worth turning rather than
 * drawn and thrown back, so the walk takes exactly as many draws as it writes
 * moves. A source that always answers the same is a source a test is entitled
 * to hand over, and rejection would have spun on it forever.
 */
export function crossScramble(random: Random): CrossScramble {
  const written: string[] = [];
  const faces: Face[] = [];

  while (written.length < CROSS_SCRAMBLE_LENGTH) {
    const last = faces[faces.length - 1];
    const beforeLast = faces[faces.length - 2];
    const allowed = FACES.filter(
      (face) =>
        face !== last &&
        !(
          last !== undefined &&
          beforeLast !== undefined &&
          AXIS[face] === AXIS[last] &&
          AXIS[face] === AXIS[beforeLast]
        ),
    );

    const face = pickFrom(allowed, random);
    if (face === undefined) break;

    written.push(face + (pickFrom(SUFFIXES, random) ?? ''));
    faces.push(face);
  }

  const text = written.join(' ');
  const parsed = parseAlg(text);
  // Every move here was written by the two lines above, out of the same
  // alphabet the parser reads; there is no input to be wrong about.
  const moves = parsed.ok ? parsed.moves : [];

  return { text, moves, state: applyAlg(solvedState(), moves) };
}
