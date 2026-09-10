import { useState } from 'react';
import type { Penalty, Solve } from '../../../db/types';
import { finalMs } from '../../../domain/solve/final-time';
import { formatClock, formatDate, formatTime } from '../../../lib/format';
import { strings } from '../../../lib/strings';

interface AttemptActionsProps {
  penalty: Penalty;
  onJudge: (penalty: Exclude<Penalty, 'none'>) => void;
  onDelete: () => void;
  /**
   * Whether the penalty is the reader's to change. A looked-up case was never
   * timed, so clearing its DNF would leave a solve of no seconds standing as
   * a time; throwing it away is the only thing left that makes sense.
   */
  judgeable?: boolean;
}

/**
 * The three things that happen to a drill attempt after the fact: a penalty
 * the timer could not know about, and a time that was a dropped cube rather
 * than a solve. Same controls as the timer's own list, because it is the same
 * job.
 */
export function AttemptActions({
  penalty,
  onJudge,
  onDelete,
  judgeable = true,
}: AttemptActionsProps) {
  return (
    <span className="solves__actions">
      {judgeable ? (
        <>
          <button
            type="button"
            className={penalty === 'plus2' ? 'is-active' : ''}
            onClick={() => onJudge('plus2')}
          >
            {strings.solve.plusTwo}
          </button>
          <button
            type="button"
            className={penalty === 'dnf' ? 'is-active' : ''}
            onClick={() => onJudge('dnf')}
          >
            {strings.solve.dnf}
          </button>
        </>
      ) : null}
      <button type="button" onClick={onDelete}>
        {strings.solve.delete}
      </button>
    </span>
  );
}

interface AttemptListProps {
  attempts: readonly Solve[];
  /** How many to show; the rest stay in the numbers above. */
  limit?: number;
  onJudge: (id: string, penalty: Exclude<Penalty, 'none'>) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}

const DEFAULT_LIMIT = 10;

/** The recent attempts at one case, newest first, each one editable. */
export function AttemptList({
  attempts,
  limit = DEFAULT_LIMIT,
  onJudge,
  onDelete,
  onDeleteAll,
}: AttemptListProps) {
  // Wiping a case's history is not undoable, so the button asks once.
  const [isArmed, setArmed] = useState(false);

  if (attempts.length === 0) return null;

  return (
    <>
      <ul className="attempts">
        {attempts.slice(0, limit).map((solve) => (
          <li key={solve.id} className="attempts__row">
            <span className="attempts__time">{formatTime(finalMs(solve))}</span>
            <span className="attempts__when">
              {formatDate(solve.createdAt)} {formatClock(solve.createdAt)}
            </span>
            <AttemptActions
              penalty={solve.penalty}
              onJudge={(penalty) => onJudge(solve.id, penalty)}
              onDelete={() => onDelete(solve.id)}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={isArmed ? 'attempts__wipe is-armed' : 'attempts__wipe'}
        onClick={() => {
          if (!isArmed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          onDeleteAll();
        }}
        onBlur={() => setArmed(false)}
      >
        {isArmed ? strings.drill.deleteAllConfirm : strings.drill.deleteAll}
      </button>
    </>
  );
}
