import { caseTitle } from '../../../domain/alg/case-name';
import { slowestCases } from '../../../domain/drill/case-stats';
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
    })),
  );
  const stats = useCaseStats(cases.map((entry) => entry.id));
  if (stats === undefined || cases.length === 0) return null;

  const drilled = cases.filter((entry) => (stats.get(entry.id)?.attempts ?? 0) > 0);
  const attempts = cases.reduce((sum, entry) => sum + (stats.get(entry.id)?.attempts ?? 0), 0);
  const slowest = slowestCases([...stats.values()], { limit: SUGGESTIONS });

  if (drilled.length === 0) {
    return <p className="set-summary set-summary--empty">{strings.drill.noneYet}</p>;
  }

  return (
    <section className="set-summary">
      <p className="set-summary__counts">
        {drilled.length} / {cases.length} {strings.drill.progress} · {attempts}{' '}
        {strings.drill.attempts.toLowerCase()}
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
