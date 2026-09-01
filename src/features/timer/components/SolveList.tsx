import type { Penalty, Solve } from '../../../db/types';
import { finalMs } from '../../../domain/solve/final-time';
import { togglePenalty } from '../../../domain/solve/penalty';
import { formatClock, formatTime } from '../../../lib/format';
import { strings } from '../../../lib/strings';

interface SolveListProps {
  solves: Solve[];
  onChangePenalty: (id: string, penalty: Penalty) => void;
  onDelete: (id: string) => void;
}

/**
 * Flat list of the session's solves. Penalties and deletion are offered on the
 * most recent solve only — full editing lands with the history screen.
 */
export function SolveList({ solves, onChangePenalty, onDelete }: SolveListProps) {
  if (solves.length === 0) {
    return <p className="solves__empty">{strings.solve.empty}</p>;
  }

  return (
    <ol className="solves">
      {solves.map((solve, index) => (
        <li key={solve.id} className="solves__row">
          <span className="solves__index">{solves.length - index}.</span>
          <span className="solves__time">{formatTime(finalMs(solve))}</span>
          <span className="solves__meta">
            {solve.penalty !== 'none' && solve.penaltySource === 'auto'
              ? strings.solve.autoPenalty
              : formatClock(solve.createdAt)}
          </span>
          {index === 0 ? (
            <span className="solves__actions">
              <button
                type="button"
                className={solve.penalty === 'plus2' ? 'is-active' : ''}
                onClick={() => onChangePenalty(solve.id, togglePenalty(solve.penalty, 'plus2'))}
              >
                {strings.solve.plusTwo}
              </button>
              <button
                type="button"
                className={solve.penalty === 'dnf' ? 'is-active' : ''}
                onClick={() => onChangePenalty(solve.id, togglePenalty(solve.penalty, 'dnf'))}
              >
                {strings.solve.dnf}
              </button>
              <button type="button" onClick={() => onDelete(solve.id)}>
                {strings.solve.delete}
              </button>
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
