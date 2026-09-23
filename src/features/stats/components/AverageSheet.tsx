import { Sheet } from '../../../components/Sheet';
import { useShareCard } from '../../../hooks/use-share-card';
import { averageCard, averageCardFilename } from '../average-card';
import { formatAverage, formatDate, formatResult } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import type { AverageWindowView } from '../hooks/use-session-stats';

interface AverageSheetProps {
  view: AverageWindowView;
  onOpenSolve: (id: string) => void;
  onClose: () => void;
}

/**
 * The solves an average was made of, with the ones the trim cut in brackets —
 * the way csTimer writes it, and the quickest way to see why an ao5 is not
 * simply the mean of the five times on it.
 */
export function AverageSheet({ view, onOpenSolve, onClose }: AverageSheetProps) {
  const title = strings.stats.windowTitle(view.at, view.n);
  const card = useShareCard();
  const first = view.solves[0]?.createdAt;
  const last = view.solves[view.solves.length - 1]?.createdAt;

  return (
    <Sheet label={title} className="average-sheet" onClose={onClose}>
      <h2 className="average-sheet__title">
        {title}
        <span className="average-sheet__value">{formatAverage(view.average)}</span>
      </h2>
      {first === undefined || last === undefined ? null : (
        <p className="detail__hint">
          {formatDate(first) === formatDate(last)
            ? formatDate(first)
            : `${formatDate(first)} – ${formatDate(last)}`}
        </p>
      )}
      <p className="detail__hint">
        {view.average === 'dnf' ? strings.stats.windowDnfNote : strings.stats.windowTrimNote(view.trim)}
      </p>
      <ol className="average-sheet__solves">
        {view.solves.map((solve) => {
          const time = formatResult(solve.resultMs, solve.penalty);
          return (
            <li key={solve.id}>
              <button
                type="button"
                className={
                  solve.isTrimmed ? 'average-sheet__solve is-trimmed' : 'average-sheet__solve'
                }
                aria-label={solve.isTrimmed ? `${time}, ${strings.stats.trimmed}` : time}
                onClick={() => onOpenSolve(solve.id)}
              >
                {solve.isTrimmed ? `(${time})` : time}
              </button>
            </li>
          );
        })}
      </ol>
      {/* Only a whole average: a window still filling, or one the trim could
          not save from a DNF, is not a number anybody posts. */}
      {typeof view.average === 'number' ? (
        <button
          type="button"
          className="average-sheet__share"
          disabled={card.isBusy}
          onClick={() => card.share(averageCard(view), averageCardFilename(view))}
        >
          {card.isBusy ? strings.share.busy : strings.share.action}
        </button>
      ) : null}
    </Sheet>
  );
}
