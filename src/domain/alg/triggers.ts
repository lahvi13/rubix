/**
 * Reading an algorithm as words instead of letters. `R U R' U' R' F R2 U' R'`
 * is fourteen symbols; as "sexy move, sledgehammer, ..." it is three things to
 * remember, which is the difference between learning a case and drilling it.
 */

import { isSameMove, type Move, type MoveGroup } from '../cube/notation';

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
  /**
   * A bracket the algorithm was written with, holding moves no trigger
   * claimed. Nobody named it, so it has no colour and no caption — it is only
   * the shape the author remembered it in.
   */
  isGroup?: boolean;
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
  groups: readonly MoveGroup[] = [],
): AlgSegment[] {
  const segments: AlgSegment[] = [];
  let loose: Move[] = [];
  let looseAt = 0;
  let index = 0;

  const flushLoose = (): void => {
    if (loose.length === 0) return;
    segments.push(...bracketed(loose, looseAt, groups));
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
    if (move) {
      if (loose.length === 0) looseAt = index;
      loose.push(move);
    }
    index += 1;
  }

  flushLoose();
  return segments;
}

/**
 * A run of unnamed moves, cut at the brackets the author wrote around them.
 *
 * Triggers come first and brackets fill in: a bracket that a trigger already
 * covers has nothing left to say, and two ways of chunking the same moves
 * drawn over each other would say neither.
 */
function bracketed(
  loose: readonly Move[],
  at: number,
  groups: readonly MoveGroup[],
): AlgSegment[] {
  const inside = groups
    .filter(([start, end]) => start >= at && end <= at + loose.length)
    .sort((a, b) => a[0] - b[0]);

  const out: AlgSegment[] = [];
  let cut = at;
  for (const [start, end] of inside) {
    if (start < cut) continue;
    if (start > cut) out.push({ moves: [...loose.slice(cut - at, start - at)], trigger: null });
    out.push({ moves: [...loose.slice(start - at, end - at)], trigger: null, isGroup: true });
    cut = end;
  }
  if (cut < at + loose.length) {
    out.push({ moves: [...loose.slice(cut - at)], trigger: null });
  }
  return out;
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
