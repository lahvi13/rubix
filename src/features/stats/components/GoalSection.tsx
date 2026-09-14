import { useState } from 'react';
import { parseTimeInput } from '../../../domain/solve/parse-time';
import { formatGoal, formatRate } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import type { GoalStats } from '../hooks/use-session-stats';

interface GoalSectionProps {
  /** null while no goal is set. */
  goal: GoalStats | null;
  solveCount: number;
  /** 0 removes the goal. */
  onChange: (goalMs: number) => void;
}

/**
 * The time being chased, and how often it is beaten — over everything, and
 * lately. The second number is the one that moves: a goal set far ahead
 * reads as 5% for months over all solves while the last fifty have long
 * since started to get there.
 */
export function GoalSection({ goal, solveCount, onChange }: GoalSectionProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [isInvalid, setInvalid] = useState(false);

  const save = () => {
    if (draft === null) return;
    const goalMs = parseTimeInput(draft);
    if (goalMs === null) {
      setInvalid(true);
      return;
    }
    onChange(goalMs);
    setDraft(null);
    setInvalid(false);
  };

  return (
    <section>
      <h2 className="stats__section-title">{strings.stats.goal}</h2>

      {draft !== null ? (
        <form
          className="goal__form"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={strings.stats.goalPlaceholder}
            aria-label={strings.stats.goalTime}
            inputMode="decimal"
            className={isInvalid ? 'is-invalid' : undefined}
          />
          <button type="submit" className="is-primary">
            {strings.stats.goalSave}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setInvalid(false);
            }}
          >
            {strings.stats.goalCancel}
          </button>
          {isInvalid ? <p className="detail__error">{strings.history.invalidTime}</p> : null}
        </form>
      ) : goal === null ? (
        <div className="goal__empty">
          <p className="detail__hint">{strings.stats.goalHint}</p>
          <button type="button" onClick={() => setDraft('')}>
            {strings.stats.goalSet}
          </button>
        </div>
      ) : (
        <div className="goal">
          <div className="goal__head">
            <span className="goal__name">{strings.stats.goalName(formatGoal(goal.goalMs))}</span>
            <button type="button" onClick={() => setDraft(formatGoal(goal.goalMs))}>
              {strings.stats.goalChange}
            </button>
            <button type="button" onClick={() => onChange(0)}>
              {strings.stats.goalRemove}
            </button>
          </div>
          <dl className="goal__rates">
            <div className="stat-card">
              <dt className="stat-card__label">{strings.stats.goalRecent(goal.recentCount)}</dt>
              <dd className="stat-card__value">{formatRate(goal.recentRate)}</dd>
            </div>
            <div className="stat-card">
              <dt className="stat-card__label">{strings.stats.goalAll(solveCount)}</dt>
              <dd className="stat-card__value">{formatRate(goal.allRate)}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
