import { caseTitle } from '../../../domain/alg/case-name';
import { slowestCases } from '../../../domain/drill/case-stats';
import { countProgress } from '../../../domain/drill/progress';
import { formatAverage } from '../../../lib/format';
import { packLabel, strings } from '../../../lib/strings';
import { useCaseStats } from '../hooks/use-case-stats';
import type { CaseGroup } from '../hooks/use-alg-cases';

interface SetSummaryProps {
  groups: CaseGroup[] | undefined;
  onOpen: (caseId: string, group: string) => void;
}

/** How many of the slowest cases to put in front of somebody. */
const SUGGESTIONS = 5;

/**
 * What the set has cost so far, and which of its cases to spend the next ten
 * minutes on. The suggestion is the whole point of drilling: a list of 57
 * cases tells nobody where to start, and "the ones you are slowest at" does.
 */
export function SetSummary({ groups, onOpen }: SetSummaryProps) {
  const cases = (groups ?? []).flatMap((group) =>
    group.cases.map((entry) => ({
      id: entry.algCase.id,
      name: packLabel(caseTitle(entry.algCase)),
      group: packLabel(group.name),
      progress: entry.algCase.progress,
    })),
  );
  const stats = useCaseStats(cases.map((entry) => entry.id));
  if (stats === undefined || cases.length === 0) return null;

  const counts = countProgress(cases.map((entry) => entry.progress));
  const attempts = cases.reduce((sum, entry) => sum + (stats.get(entry.id)?.attempts ?? 0), 0);
  const slowest = slowestCases([...stats.values()], { limit: SUGGESTIONS });

  // A set nobody has touched stays one quiet line, as it always was: a bar at
  // nought and a count of nothing would be a screenful of zeros.
  if (attempts === 0 && counts.new === counts.total) {
    return <p className="set-summary set-summary--empty">{strings.drill.noneYet}</p>;
  }

  const share = (count: number): string => `${(count / counts.total) * 100}%`;

  return (
    <section className="set-summary">
      {/* Known first and learning after it, both from the left, so the bar
          fills the way the set is learned. The line under it says the same in
          words, which is what a screen reader gets. */}
      <div className="set-summary__bar" aria-hidden="true">
        <span className="set-summary__bar-known" style={{ width: share(counts.known) }} />
        <span className="set-summary__bar-learning" style={{ width: share(counts.learning) }} />
      </div>
      <p className="set-summary__counts">
        {strings.trainer.progressKnown(counts.known, counts.total)}
        {counts.learning === 0 ? null : ` · ${strings.trainer.progressLearning(counts.learning)}`}
        {attempts === 0 ? null : ` · ${strings.drill.attemptCount(attempts)}`}
      </p>

      {slowest.length === 0 ? null : (
        <div className="set-summary__slowest">
          <span className="drill__hint">{strings.drill.needsWork}</span>
          {slowest.map((entry) => {
            const algCase = cases.find((candidate) => candidate.id === entry.caseId);
            if (algCase === undefined) return null;
            return (
              <button
                key={entry.caseId}
                type="button"
                className="set-summary__chip"
                onClick={() => onOpen(algCase.id, algCase.group)}
              >
                {algCase.name} <span>{formatAverage(entry.ao5 ?? entry.meanMs)}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
