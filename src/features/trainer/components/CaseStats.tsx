import type { CaseStats } from '../../../domain/drill/case-stats';
import { formatAverage, formatRate, formatTime } from '../../../lib/format';
import { strings } from '../../../lib/strings';

/**
 * What this case has cost you so far. Same numbers wherever a case is shown —
 * after a drill attempt and in the case sheet — because "am I slow at this
 * one" is the same question in both places.
 */
export function CaseStatsRow({ stats }: { stats: CaseStats | undefined }) {
  if (stats === undefined || stats.attempts === 0) {
    return <p className="drill__hint">{strings.drill.noAttempts}</p>;
  }

  return (
    <dl className="mini-stats drill__stats">
      <div className="mini-stats__item">
        <dt>{strings.drill.attempts}</dt>
        <dd>{stats.attempts}</dd>
      </div>
      <div className="mini-stats__item">
        <dt>{strings.drill.last}</dt>
        <dd>{formatTime(stats.lastMs)}</dd>
      </div>
      <div className="mini-stats__item">
        <dt>{strings.stats.best}</dt>
        <dd>{formatAverage(stats.bestMs)}</dd>
      </div>
      <div className="mini-stats__item">
        <dt>ao5</dt>
        <dd>{formatAverage(stats.ao5)}</dd>
      </div>
      <div className="mini-stats__item">
        <dt>ao12</dt>
        <dd>{formatAverage(stats.ao12)}</dd>
      </div>
      <div className="mini-stats__item">
        <dt>{strings.stats.dnfRate}</dt>
        <dd>{formatRate(stats.dnfRate)}</dd>
      </div>
    </dl>
  );
}
