import type { MethodPhase, Solve } from '../../../db/types';
import { PhaseBar, type PhaseBarDetail } from './PhaseBar';

interface SolvePhasesProps {
  solve: Solve;
  phases: readonly MethodPhase[];
  detail: PhaseBarDetail;
  /** Fastest each phase has been in the list this row belongs to, in method order. */
  bestMs?: readonly (number | null)[];
}

/**
 * The phase strip as a row of a list wears it: across the row's columns,
 * under the time it belongs to, and absent altogether for a solve that was
 * timed as a whole. The timer's list and the history's list want the same
 * thing here, so they ask for it in the same place.
 */
export function SolvePhases({ solve, phases, detail, bestMs }: SolvePhasesProps) {
  if (solve.splits.length === 0) return null;

  return (
    <span className="solve-phases">
      <PhaseBar
        splits={solve.splits}
        phases={phases}
        rawMs={solve.rawMs}
        detail={detail}
        bestMs={bestMs}
      />
    </span>
  );
}
