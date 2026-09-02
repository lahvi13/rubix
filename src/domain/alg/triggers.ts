/**
 * Reading an algorithm as words instead of letters. `R U R' U' R' F R2 U' R'`
 * is fourteen symbols; as "sexy move, sledgehammer, ..." it is three things to
 * remember, which is the difference between learning a case and drilling it.
 */

import { isSameMove, type Move } from '../cube/notation';

export interface TriggerDefinition {
  id: string;
  name: string;
  /** Already parsed, because a segment is matched move by move. */
  moves: Move[];
  /** How it is highlighted; the caller decides what to do without one. */
  colour?: string;
}

export interface AlgSegment {
  moves: Move[];
  /** The trigger these moves are, or null for moves that are just moves. */
  trigger: TriggerDefinition | null;
}

/**
 * Splits an algorithm into triggers and the moves between them, longest match
 * first. Greedy on purpose: overlapping triggers would need a choice nobody
 * can explain to the reader, and the longest one is the one a cuber sees.
 *
 * Triggers are expected in the order they should be tried (longest first).
 */
export function segmentAlg(
  moves: readonly Move[],
  triggers: readonly TriggerDefinition[],
): AlgSegment[] {
  const segments: AlgSegment[] = [];
  let loose: Move[] = [];
  let index = 0;

  const flushLoose = (): void => {
    if (loose.length === 0) return;
    segments.push({ moves: loose, trigger: null });
    loose = [];
  };

  while (index < moves.length) {
    const match = triggers.find((trigger) => matchesAt(moves, index, trigger.moves));

    if (match) {
      flushLoose();
      segments.push({ moves: moves.slice(index, index + match.moves.length), trigger: match });
      index += match.moves.length;
      continue;
    }

    const move = moves[index];
    if (move) loose.push(move);
    index += 1;
  }

  flushLoose();
  return segments;
}

function matchesAt(moves: readonly Move[], start: number, pattern: readonly Move[]): boolean {
  if (pattern.length === 0 || start + pattern.length > moves.length) return false;

  return pattern.every((expected, offset) => {
    const actual = moves[start + offset];
    return actual !== undefined && isSameMove(actual, expected);
  });
}

/** How much of the algorithm a reader can take in as named chunks. */
export function triggerCoverage(segments: readonly AlgSegment[]): number {
  const total = segments.reduce((count, segment) => count + segment.moves.length, 0);
  if (total === 0) return 0;

  const covered = segments
    .filter((segment) => segment.trigger !== null)
    .reduce((count, segment) => count + segment.moves.length, 0);
  return covered / total;
}
