import { useState } from 'react';
import { AVERAGE_WINDOWS, type AverageWindow } from '../../../domain/stats/averages';
import { formatDate, formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import type { RecordEntry, RecordKind } from '../hooks/use-session-stats';

const KINDS: readonly RecordKind[] = ['single', ...AVERAGE_WINDOWS];
/** A first session sets a record nearly every solve; the recent ones are the story. */
const SHOWN_AT_FIRST = 8;

interface RecordsSectionProps {
  recordsFor: (kind: RecordKind) => RecordEntry[];
  globalPbMs: number | null;
  onOpenSolve: (id: string) => void;
  onOpenWindow: (n: AverageWindow, endIndex: number) => void;
}

/**
 * When each best fell and by how much. The table above says where the records
 * stand; this is how they got there, which is the part that shows practice
 * working.
 */
export function RecordsSection({
  recordsFor,
  globalPbMs,
  onOpenSolve,
  onOpenWindow,
}: RecordsSectionProps) {
  const [kind, setKind] = useState<RecordKind>('single');
  const [isExpanded, setExpanded] = useState(false);
  const records = recordsFor(kind);
  const shown = isExpanded ? records : records.slice(0, SHOWN_AT_FIRST);
  // The history's two tiers: the newest row is the best of what is read, in
  // gold only when it is the personal best itself. An average has no PB to
  // be — archived sessions and older solves are not in the list it is from.
  const topClass =
    kind === 'single' && records[0]?.ms === globalPbMs ? 'record is-record' : 'record is-best';

  return (
    <section className="stats-panel">
      <h2 className="stats__section-title">{strings.stats.records}</h2>
      <div className="chart-modes" role="group" aria-label={strings.stats.recordKind}>
        {KINDS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={candidate === kind ? 'is-active' : undefined}
            aria-pressed={candidate === kind}
            onClick={() => {
              setKind(candidate);
              setExpanded(false);
            }}
          >
            {candidate === 'single' ? strings.stats.singleSeries : `ao${candidate}`}
          </button>
        ))}
      </div>

      {records.length === 0 ? (
        <p className="detail__hint">{strings.stats.noRecords(kind === 'single' ? 1 : kind)}</p>
      ) : (
        <ol className="records" aria-label={strings.stats.records}>
          {shown.map((record, order) => (
            <li key={record.endIndex}>
              <button
                type="button"
                className={order === 0 ? topClass : 'record'}
                onClick={() =>
                  kind === 'single'
                    ? onOpenSolve(record.solveId)
                    : onOpenWindow(kind, record.endIndex)
                }
              >
                <span className="record__time">{formatMs(record.ms)}</span>
                <span className="record__gain">
                  {record.improvementMs === null
                    ? strings.stats.firstRecord
                    : `−${formatMs(record.improvementMs)}`}
                </span>
                <span className="record__date">{formatDate(record.at)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {records.length > SHOWN_AT_FIRST ? (
        <button type="button" className="records__more" onClick={() => setExpanded(!isExpanded)}>
          {isExpanded ? strings.stats.fewerRecords : strings.stats.allRecords(records.length)}
        </button>
      ) : null}
    </section>
  );
}
