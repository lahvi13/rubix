import { memo } from 'react';
import type { MethodPhase, Penalty, Solve } from '../../../db/types';
import { PhaseBar } from '../../splits';
import { finalMs } from '../../../domain/solve/final-time';
import { togglePenalty } from '../../../domain/solve/penalty';
import { now } from '../../../lib/clock';
import { formatTime, formatWhen } from '../../../lib/format';
import { strings } from '../../../lib/strings';

interface SolveListProps {
  solves: Solve[];
  /**
   * Told when the list has been scrolled off its top, so the screen can hand
   * it more room. Reading further is the reason anyone scrolls a list of four
   * rows, and it should not have to be asked for twice.
   *
   * Only ever true: growing the list can leave its contents fitting, and a
   * scroll position that falls back to zero on its own would put the list
   * straight back where it was.
   */
  onScrolled: () => void;
  /** A solve in the list is a way into it, the same as one in the history. */
  onOpen: (id: string) => void;
  /** The session's method, so a timed solve can show the shape of its phases. */
  phases: readonly MethodPhase[];
  onChangePenalty: (id: string, penalty: Penalty) => void;
  onDelete: (id: string) => void;
}

/**
 * Flat list of the session's solves. Penalties and deletion are offered on the
 * most recent solve only — full editing lands with the history screen.
 * Memoised: the timer above repaints every animation frame, and fifty rows
 * must not be re-rendered sixty times a second on a phone.
 */
export const SolveList = memo(function SolveList({
  solves,
  phases,
  onScrolled,
  onOpen,
  onChangePenalty,
  onDelete,
}: SolveListProps) {
  if (solves.length === 0) {
    return <p className="solves__empty">{strings.solve.empty}</p>;
  }

  // Read once for the whole list: every row is asking the same question.
  const at = now();

  return (
    <ol
      className="solves"
      onScroll={(event) => {
        if (event.currentTarget.scrollTop > 8) onScrolled();
      }}
    >
      {solves.map((solve, index) => (
        <li key={solve.id} className="solves__row">
          <button type="button" className="solves__open" onClick={() => onOpen(solve.id)}>
            <span className="solves__index">{solves.length - index}.</span>
            <span className="solves__time">{formatTime(finalMs(solve))}</span>
            <span className="solves__meta">
              {solve.penalty !== 'none' && solve.penaltySource === 'auto'
                ? strings.solve.autoPenalty
                : formatWhen(solve.createdAt, at)}
            </span>
          </button>
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
          {/* Which of them were timed by phase, without opening any. No
              numbers: at this height only the shape can be read. */}
          {solve.splits.length > 0 ? (
            <span className="solves__phases">
              <PhaseBar
                splits={solve.splits}
                phases={phases}
                rawMs={solve.rawMs}
                showLabels={false}
              />
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
});
