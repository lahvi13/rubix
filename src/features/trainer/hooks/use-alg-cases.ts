import { useLiveQuery } from 'dexie-react-hooks';
import type { AlgCase, AlgSet, Algorithm } from '../../../db/types';
import { listCasesWithAlgs, listSets } from '../../../db/repositories/alg-repository';
import { parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState, type CubeState } from '../../../domain/cube/state';
import { diagramFor } from '../case-view';

export interface TrainerCase {
  algCase: AlgCase;
  /** The variant being drilled — the pack one until the user picks another. */
  algorithm: Algorithm | null;
  /** The cube as the case is met, worked out from the case's setup. */
  state: CubeState;
}

export interface CaseGroup {
  name: string;
  cases: TrainerCase[];
}

/**
 * The sets, or `undefined` while the database has not answered yet. The
 * difference matters: a stuck connection would otherwise be indistinguishable
 * from an app with no algorithms in it, which is exactly what it looked like.
 */
export function useAlgSets(): AlgSet[] | undefined {
  return useLiveQuery(listSets, []);
}

/**
 * The cases of one set, in pack order and grouped the way the set groups them
 * (dot shapes, corners only, and so on). The cube state of each case is worked
 * out here rather than stored — a stored picture would go stale the moment a
 * setup changed — and stood the way that set is looked at, so a card and the
 * sheet it opens show the same cube.
 */
export function useSetCases(setId: string | null): CaseGroup[] | undefined {
  const cases = useLiveQuery(async () => (setId === null ? [] : listCasesWithAlgs(setId)), [setId]);
  if (cases === undefined) return undefined;

  const groups: CaseGroup[] = [];
  for (const entry of cases) {
    const name = entry.algCase.group ?? '';
    const group = groups.find((candidate) => candidate.name === name);
    const trainerCase: TrainerCase = {
      algCase: entry.algCase,
      algorithm: entry.active,
      state: stateOf(entry.algCase.setupAlg, diagramFor(setId ?? '', name).orientation),
    };

    if (group) group.cases.push(trainerCase);
    else groups.push({ name, cases: [trainerCase] });
  }
  return groups;
}

/**
 * The cube a case is met on. The orientation goes in front of the setup rather
 * than after it: turning the cube first repaints the faces the setup then
 * works on, which leaves the case in the same slot in a different colour —
 * turning it afterwards would move the case itself out of view.
 */
export function stateOf(setupAlg: string, orientation = ''): CubeState {
  const parsed = parseAlg(`${orientation} ${setupAlg}`);
  return parsed.ok ? applyAlg(solvedState(), parsed.moves) : solvedState();
}
