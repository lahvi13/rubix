import type { MethodPhase } from '../../../db/types';
import type { PhaseAverageRow } from '../../../domain/stats/phases';
import type { Average } from '../../../domain/stats/averages';
import { formatAverage } from '../../../lib/format';
import { phaseFillColour } from '../../../lib/phase-colours';
import { strings } from '../../../lib/strings';

/** The window column: an average, every solve, or the fastest each phase has been. */
function rowLabel(n: PhaseAverageRow['n']): string {
  if (n === 'all') return strings.splits.all;
  if (n === 'best') return strings.splits.best;
  return `ao${n}`;
}

interface PhaseAveragesProps {
  rows: readonly PhaseAverageRow[];
  phases: readonly MethodPhase[];
  /** Solves behind the table — the ones that were timed by phase. */
  measuredCount: number;
  /** Solves in the session, so the heading can say why the two differ. */
  solveCount: number;
  /** Opens the solve a best was set in. */
  onOpenSolve?: (solveId: string) => void;
}

/**
 * Which phase is the slow one, over each of the usual windows. The phase
 * columns average the same solves the trim keeps, so with every boundary
 * recorded they add up to the total on the right.
 */
export function PhaseAverages({
  rows,
  phases,
  measuredCount,
  solveCount,
  onOpenSolve,
}: PhaseAveragesProps) {
  if (measuredCount === 0 || phases.length === 0) return null;

  return (
    <section className="stats-panel">
      <h2 className="stats__section-title">
        {strings.splits.phaseAverages} · {measuredCount}
      </h2>
      {/* "· 19" under a session of 20 read as an error until it said which
          nineteen it meant. */}
      <p className="chart-note chart-note--above">
        {strings.splits.measuredNote(measuredCount, solveCount)}
      </p>
      <div className="table-scroll">
        <table className="averages-table averages-table--phases">
          <thead>
            <tr>
              <th />
              {phases.map((phase, index) => (
                <th key={phase.key}>
                  {phase.label}
                  {/* The phase by its face, as a strip under its name, and the
                      figures in the text's own colour: a face light enough to
                      be the cube's is too light to write a number in, and
                      darkened until it could be, the yellow was mustard. Under
                      the name, as an underline joining it to its column; not
                      beside it — beside it, it widened every column and the
                      total ran off a phone. */}
                  <span
                    className="averages-table__phase"
                    style={{ background: phaseFillColour(index, phases.length) }}
                    aria-hidden="true"
                  />
                </th>
              ))}
              <th>{strings.splits.total}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.n)}>
                <th scope="row">{rowLabel(row.n)}</th>
                {row.phases.map((phase) => (
                  <td
                    key={phase.phase}
                    // A column built from fewer solves than the row is not
                    // wrong, but it is not the same sample either.
                    title={strings.stats.solveCount(phase.count)}
                  >
                    <Value ms={phase.ms} solveId={phase.solveId} onOpen={onOpenSolve} />
                  </td>
                ))}
                <td className="averages-table__total">
                  <Value ms={row.totalMs} solveId={row.totalSolveId} onOpen={onOpenSolve} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface ValueProps {
  ms: Average;
  solveId: string | null;
  onOpen: ((solveId: string) => void) | undefined;
}

/** A best was set in one solve, and opens it; an average belongs to none. */
function Value({ ms, solveId, onOpen }: ValueProps) {
  if (solveId === null || onOpen === undefined) return <>{formatAverage(ms)}</>;
  return (
    <button type="button" className="averages-table__open" onClick={() => onOpen(solveId)}>
      {formatAverage(ms)}
    </button>
  );
}
