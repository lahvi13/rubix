import type { MethodPhase, Solve } from '../../../db/types';
import { PhaseBar, type PhaseBarDetail } from './PhaseBar';

interface SolvePhasesProps {
  solve: Solve;
  phases: readonly MethodPhase[];
  detail: PhaseBarDetail;
  /** Phases of this solve that are the fastest that phase has been in the list. */
  bestPhases?: readonly string[];
}

/**
 * The phase strip as a row of a list wears it: across the row's columns,
 * under the time it belongs to, and absent altogether for a solve that was
 * timed as a whole. The timer's list and the history's list want the same
 * thing here, so they ask for it in the same place.
 */
export function SolvePhases({ solve, phases, detail, bestPhases }: SolvePhasesProps) {
  if (solve.splits.length === 0) return null;

  return (
    <span className="solve-phases">
      <PhaseBar
        splits={solve.splits}
        phases={phases}
        rawMs={solve.rawMs}
        detail={detail}
        bestPhases={bestPhases}
      />
    </span>
  );
}
