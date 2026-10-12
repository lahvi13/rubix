import type { Move } from '../cube/notation';

/**
 * Whether an algorithm is written for the left hand: it turns the left side
 * and never the right one.
 *
 * Read off the moves rather than recorded with them. The one-handed sheets
 * give every case an algorithm for each hand, and a mirrored F2L insert is the
 * same thing; a reader scanning a case's alternatives wants to know which of
 * them they can skip, and "another way" does not say.
 */
export function isLeftHanded(moves: readonly Move[]): boolean {
  const turns = (side: 'L' | 'R') =>
    moves.some((move) => move.family === side || move.family === `${side}w`);
  return turns('L') && !turns('R');
}
