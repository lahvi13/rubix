import { memo } from 'react';
import type { Puzzle } from '../../../db/types';
import { formatAverage } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useSessionStats } from '../hooks/use-session-stats';

interface MiniStatsProps {
  sessionId: string | null;
  puzzle: Puzzle;
}

/**
 * The timer screen's one-line summary: current ao5, ao12 and session mean.
 * Memoised because the host screen repaints on animation frames while timing.
 */
export const MiniStats = memo(function MiniStats({ sessionId, puzzle }: MiniStatsProps) {
  const stats = useSessionStats({ kind: 'session', sessionId }, puzzle);
  if (stats === null || stats.solveCount === 0) return null;

  const ao5 = stats.windows.find((window) => window.n === 5)?.current ?? null;
  const ao12 = stats.windows.find((window) => window.n === 12)?.current ?? null;

  return (
    <dl className="mini-stats">
      <div className="mini-stats__item">
        <dt>ao5</dt>
        <dd>{formatAverage(ao5)}</dd>
      </div>
      <div className="mini-stats__item">
        <dt>ao12</dt>
        <dd>{formatAverage(ao12)}</dd>
      </div>
      <div className="mini-stats__item">
        <dt>{strings.stats.mean}</dt>
        <dd>{formatAverage(stats.meanMs)}</dd>
      </div>
    </dl>
  );
});
