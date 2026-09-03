import type { MethodPhase } from '../../../db/types';
import type { PhaseAverageRow } from '../../../domain/stats/phases';
import { formatAverage } from '../../../lib/format';
import { phaseColour } from '../../../lib/phase-colours';
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
}

/**
 * Which phase is the slow one, over each of the usual windows. The phase
 * columns average the same solves the trim keeps, so with every boundary
 * recorded they add up to the total on the right.
 */
export function PhaseAverages({ rows, phases, measuredCount }: PhaseAveragesProps) {
  if (measuredCount === 0 || phases.length === 0) return null;

  return (
    <section>
      <h2 className="stats__section-title">
        {strings.splits.phaseAverages} · {measuredCount}
      </h2>
      <div className="table-scroll">
        <table className="averages-table averages-table--phases">
          <thead>
            <tr>
              <th />
              {phases.map((phase, index) => (
                <th key={phase.key} style={{ color: phaseColour(index, phases.length) }}>
                  {phase.label}
                </th>
              ))}
              <th>{strings.splits.total}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.n)}>
                <th scope="row">{rowLabel(row.n)}</th>
                {row.phases.map((phase, index) => (
                  <td
                    key={phase.phase}
                    style={{ color: phaseColour(index, phases.length) }}
                    // A column built from fewer solves than the row is not
                    // wrong, but it is not the same sample either.
                    title={`${phase.count} ${strings.stats.solves}`}
                  >
                    {formatAverage(phase.ms)}
                  </td>
                ))}
                <td className="averages-table__total">{formatAverage(row.totalMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
