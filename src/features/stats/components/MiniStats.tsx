import { memo } from 'react';
import { useSetting } from '../../../hooks/use-setting';
import type { Solve } from '../../../db/types';
import { formatAverage, formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useMiniStats } from '../hooks/use-mini-stats';

interface MiniStatsProps {
  /** The session's solves, oldest first, as the host screen already reads them. */
  solves: readonly Solve[] | undefined;
}

/**
 * The timer screen's one-line summary: current ao5 and ao12, the session
 * mean where there is room for it, and under them what the next solve needs
 * for a best average of the session.
 * Memoised because the host screen repaints on animation frames while timing.
 */
export const MiniStats = memo(function MiniStats({ solves }: MiniStatsProps) {
  const stats = useMiniStats(solves);
  const [showNextRecord] = useSetting('timer.showNextRecord');
  if (stats === null || stats.solveCount === 0) return null;

  return (
    <>
      <dl className="mini-stats">
        <div className="mini-stats__item">
          <dt>ao5</dt>
          <dd>{formatAverage(stats.ao5)}</dd>
        </div>
        <div className="mini-stats__item">
          <dt>ao12</dt>
          <dd>{formatAverage(stats.ao12)}</dd>
        </div>
        {/* Not on a phone: with minute-long times the three no longer fit one
            row there, and the mean is the one least wanted between solves. */}
        <div className="mini-stats__item mini-stats__item--wide">
          <dt>{strings.stats.mean}</dt>
          <dd>{formatAverage(stats.meanMs)}</dd>
        </div>
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
