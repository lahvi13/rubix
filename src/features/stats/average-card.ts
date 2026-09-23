import { formatAverage, formatDate, formatIsoDate, formatResult } from '../../lib/format';
import type { ShareCard } from '../../lib/share-card';
import { strings } from '../../lib/strings';
import type { AverageWindowView } from './hooks/use-session-stats';

/**
 * An average as a picture, written the way cubers post one: the number, then
 * every time behind it with the trimmed ones in brackets — which is what makes
 * an ao5 checkable rather than just claimed.
 */
export function averageCard(view: AverageWindowView): ShareCard {
  const first = view.solves[0]?.createdAt;
  const last = view.solves[view.solves.length - 1]?.createdAt;
  const dates =
    first === undefined || last === undefined
      ? ''
      : formatDate(first) === formatDate(last)
        ? formatDate(first)
        : `${formatDate(first)} – ${formatDate(last)}`;

  return {
    kicker: strings.stats.windowTitle(view.at, view.n),
    headline: formatAverage(view.average),
    badge: null,
    detail: view.solves
      .map((solve) => {
        const time = formatResult(solve.resultMs, solve.penalty);
        return solve.isTrimmed ? `(${time})` : time;
      })
      .join(' '),
    date: dates,
  };
}

export function averageCardFilename(view: AverageWindowView): string {
  const last = view.solves[view.solves.length - 1]?.createdAt ?? 0;
  return `rubix-ao${view.n}-${formatIsoDate(last)}.png`;
}
