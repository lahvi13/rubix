import { memo } from 'react';
import { useSetting } from '../../../hooks/use-setting';
import type { Solve } from '../../../db/types';
import { formatAverage, formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useMiniStats } from '../hooks/use-mini-stats';

interface MiniStatsProps {
  /** The session's solves, oldest first, as the host screen already reads them. */
  solves: readonly Solve[] | undefined;
  /**
   * The session's method, named, where the host has reason to say it — see
   * `useMethodLabel`. It is shown from the first moment, before any solve:
   * a session just made is when "which method is this?" is asked.
   */
  methodName?: string | null;
}

/**
 * The timer screen's one-line summary: current ao5 and ao12, the session
 * mean where there is room for it, at the far end the method where it needs
 * saying, and under them what the next solve needs for a best average of the
 * session.
 * Memoised because the host screen repaints on animation frames while timing.
 */
export const MiniStats = memo(function MiniStats({ solves, methodName = null }: MiniStatsProps) {
  const stats = useMiniStats(solves);
  const [showNextRecord] = useSetting('timer.showNextRecord');
  if (stats === null) return null;
  const hasSolves = stats.solveCount > 0;
  if (!hasSolves && methodName === null) return null;

  return (
    <>
      <dl className="mini-stats">
        {!hasSolves ? null : (
          <>
            <div className="mini-stats__item">
              <dt>ao5</dt>
              <dd>{formatAverage(stats.ao5)}</dd>
            </div>
            <div className="mini-stats__item">
              <dt>ao12</dt>
              <dd>{formatAverage(stats.ao12)}</dd>
            </div>
            {/* Not on a phone: with minute-long times the three no longer fit
                one row there, and the mean is the one least wanted between
                solves. */}
            <div className="mini-stats__item mini-stats__item--wide">
              <dt>{strings.stats.mean}</dt>
              <dd>{formatAverage(stats.meanMs)}</dd>
            </div>
          </>
        )}
        {/* Under the two switches, where the row has room to spare: said once
            and quietly, and it costs the panel no line of its own. */}
        {methodName === null ? null : (
          <div className="mini-stats__item mini-stats__item--method">
            <dt className="visually-hidden">{strings.sessions.method}</dt>
            <dd>{methodName}</dd>
          </div>
        )}
      </dl>
      {/* Only what can still happen: a best out of reach is not news, and a
          line saying so after every solve would be the one people learn to
          skip. */}
      {!showNextRecord || stats.nextRecords.length === 0 ? null : (
        <p className="mini-stats__next">
          {strings.stats.nextRecord}{' '}
          {stats.nextRecords.map((next, index) => (
            <span key={next.n}>
              {index > 0 ? ' · ' : null}
              {/* Breaks between the two, never inside one: "ao12 under" at the
                  end of a line and its time on the next read as two things. */}
              <span className="mini-stats__chance">
                {strings.stats.nextRecordBelow(next.n, formatMs(next.belowMs))}
              </span>
            </span>
          ))}
        </p>
      )}
    </>
  );
});
