import { memo } from 'react';
import type { Solve } from '../../../db/types';
import { formatAverage } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useMiniStats } from '../hooks/use-mini-stats';

interface MiniStatsProps {
  /** The session's solves, oldest first, as the host screen already reads them. */
  solves: readonly Solve[] | undefined;
}

/**
 * The timer screen's one-line summary: current ao5, ao12 and session mean.
 * Memoised because the host screen repaints on animation frames while timing.
 */
export const MiniStats = memo(function MiniStats({ solves }: MiniStatsProps) {
  const stats = useMiniStats(solves);
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
