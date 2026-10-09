/**
 * The algorithm for the case as it was shown.
 *
 * A recognition question meets the case at a random angle — the drill's own
 * scramble turns the cube and adds a U turn (see domain/drill/scramble.ts) —
 * and an algorithm written for the case straight on does not solve it from
 * there. What is missing is one turn of the top layer in front, which is the
 * same AUF a solver works out for themselves with the cube in their hands.
 *
 * It is found by trying, not by undoing the scramble's own AUF. The algorithm
 * on show is whichever one the case is set to, and a user can type in one that
 * carries its own AUF or starts by rotating the cube; inverting the scramble
 * would be right about the pack and wrong about them. Four candidates over a
 * dozen moves is nothing to run.
 *
 * Nor is "solves it" always "leaves the cube solved". An OLL algorithm of
 * somebody's own orients the layer and permutes it its own way, and a PLL may
 * end a U turn off; both still solve the case. So an outright solve is looked
 * for first — every pack algorithm has one, and the answer stays what it was —
 * and then a solve as far as the set looks at the case, with the final turn a
 * solver makes anyway.
 *
 * Where more than one turn works — a symmetric case such as H, or an algorithm
 * that only has to orient — the shortest one that makes the layer look the way
 * the trainer draws the case is tried first. That is the case as it was
 * learned, and the algorithm as it was learned from there.
 */

import { canonicalise } from '../cube/orientation';
import { formatAlg, invertAlg, parseAlg, type Move } from '../cube/notation';
import { applyAlg, isSolvedIgnoringOrientation, type CubeState } from '../cube/state';
import { isJudgedAsHeld, isSolvedAsShown, lastLayerView, type Stickering } from '../cube/views';

/** Shortest first: no turn, a quarter either way, then a half. Order decides ties. */
const AUFS: readonly string[] = ['', 'U', "U'", 'U2'];

const CANDIDATES: readonly Move[][] = AUFS.map((text) => {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`AUF does not parse: ${text}`);
  return parsed.moves;
});

export interface AngleOptions {
  /** What the set looks at in a case; the judge of a solve short of outright. */
  stickering?: Stickering;
  /** The U turn the question's scramble added after the setup. */
  scrambleAuf?: string;
}

/**
 * The turn to put in front of the algorithm so it solves the cube as drawn.
 * An empty list means it already does; null means no AUF makes it solve, which
 * is what an algorithm that does not belong to this case looks like.
 *
 * "Where the trainer draws the case" is judged by how the layer looks, not by
 * which pieces sit where: H turned a half turn looks exactly as it did, and
 * a U2 in front of it would be a turn that changes nothing anybody can see.
 */
export function aufForAngle(
  state: CubeState,
  algMoves: readonly Move[],
  { stickering = 'full', scrambleAuf = '' }: AngleOptions = {},
): Move[] | null {
  if (algMoves.length === 0) return null;

  const looks = (turned: CubeState) =>
    JSON.stringify(lastLayerView(canonicalise(turned), stickering));
  const undo = undoing(scrambleAuf);
  const asTrained = looks(applyAlg(state, undo));
  const isHome = (auf: readonly Move[]) => looks(applyAlg(state, auf)) === asTrained;
  // Between two turns of the same length, the one that undoes the scramble's.
  const isUndo = (auf: readonly Move[]) => formatAlg(auf) === formatAlg(undo);
  const home = CANDIDATES.filter(isHome).sort(
    (left, right) => quarters(left) - quarters(right) || Number(isUndo(right)) - Number(isUndo(left)),
  );
  const candidates = [...home, ...CANDIDATES.filter((auf) => !isHome(auf))];
  const results = candidates.map((auf) => applyAlg(applyAlg(state, auf), algMoves));

  const outright = results.findIndex((result) => isSolvedIgnoringOrientation(result));
  if (outright !== -1) return [...(candidates[outright] ?? [])];

  // A Roux case is not stood up at all: the algorithm may leave the middle
  // slice turned, which moves the centres the usual way goes by, and its
  // blocks are wherever its left and right are (isSolvedAsShown).
  const standUp = isJudgedAsHeld(stickering) ? (turned: CubeState) => turned : canonicalise;
  const asShown = results.findIndex((result) => {
    const upright = standUp(result);
    return CANDIDATES.some((end) => isSolvedAsShown(applyAlg(upright, end), stickering));
  });
  return asShown === -1 ? null : [...(candidates[asShown] ?? [])];
}

/** How far a turn of the top layer goes: none, a quarter, or a half. */
function quarters(auf: readonly Move[]): number {
  const text = formatAlg(auf);
  return text === '' ? 0 : text === 'U2' ? 2 : 1;
}

/** The turn that takes a U turn back. */
function undoing(auf: string): Move[] {
  const parsed = parseAlg(auf);
  return parsed.ok ? invertAlg(parsed.moves) : [];
}
