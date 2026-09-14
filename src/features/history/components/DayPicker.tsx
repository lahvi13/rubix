import { Sheet } from '../../../components/Sheet';
import { now } from '../../../lib/clock';
import { formatDay } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import type { SolveDay } from '../hooks/use-solve-days';

interface DayPickerProps {
  days: readonly SolveDay[];
  /** The day being read, if the list is narrowed to one. */
  selected: string | undefined;
  onPick: (day: string | undefined) => void;
  onClose: () => void;
}

/**
 * Which day of practice to read. A list of the days that happened rather than
 * a calendar: with the list paged fifty at a time, reaching a fortnight back by
 * scrolling is a chore, and the days a session was actually practised on are
 * both the way there and an answer worth having on its own.
 */
export function DayPicker({ days, selected, onPick, onClose }: DayPickerProps) {
  return (
    <Sheet label={strings.history.days} className="day-picker" onClose={onClose}>
      <h2 className="session-picker__title">{strings.history.days}</h2>

      {days.length === 0 ? <p className="detail__hint">{strings.history.noDays}</p> : null}

      <ul className="day-list">
        {days.length === 0 ? null : (
          <li>
            <button
              type="button"
              className={selected === undefined ? 'day is-active' : 'day'}
              aria-current={selected === undefined ? 'true' : undefined}
              onClick={() => {
                onPick(undefined);
                onClose();
              }}
            >
              <span className="day__name">{strings.history.allDays}</span>
            </button>
          </li>
        )}
        {days.map((day) => (
          <li key={day.key}>
            <button
              type="button"
              className={selected === day.key ? 'day is-active' : 'day'}
              aria-current={selected === day.key ? 'true' : undefined}
              onClick={() => {
                onPick(day.key);
                onClose();
              }}
            >
              <span className="day__name">{formatDay(day.at, now())}</span>
              <span className="day__count">{strings.sessions.solveCount(day.count)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
