import { memo } from 'react';
import { formatAverage } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useMiniStats } from '../hooks/use-mini-stats';

interface MiniStatsProps {
  sessionId: string | null;
}

/**
 * The timer screen's one-line summary: current ao5, ao12 and session mean.
 * Memoised because the host screen repaints on animation frames while timing.
 */
export const MiniStats = memo(function MiniStats({ sessionId }: MiniStatsProps) {
  const stats = useMiniStats(sessionId);
  if (stats === null || stats.solveCount === 0) return null;

  return (
    <dl className="mini-stats">
      <div className="mini-stats__item">
        <dt>ao5</dt>
        <dd>{formatAverage(stats.ao5)}</dd>
      </div>
      <div className="mini-stats__item">
        <dt>ao12</dt>
        <dd>{formatAverage(stats.ao12)}</dd>
      </div>
      <div className="mini-stats__item">
        <dt>{strings.stats.mean}</dt>
        <dd>{formatAverage(stats.meanMs)}</dd>
      </div>
    </dl>
  );
});
