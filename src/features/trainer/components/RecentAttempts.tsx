import { CubeDiagram } from '../../../components/CubeDiagram';
import type { AlgCase } from '../../../db/types';
import { caseTitle } from '../../../domain/alg/case-name';
import type { DrillRun } from '../../../domain/drill/recent';
import type { CubeSkin } from '../../../lib/cube-skins';
import { formatAverage, formatDelta, formatResult } from '../../../lib/format';
import { packLabel, strings } from '../../../lib/strings';
import { diagramFor } from '../case-view';
import { stateOf } from '../hooks/use-alg-cases';

interface RecentAttemptsProps {
  run: DrillRun;
  /** The set's cases by id, for their names and pictures. */
  cases: ReadonlyMap<string, AlgCase>;
  setId: string;
  skin: CubeSkin;
  /** The cross has no case to picture, only a scramble. */
  withPictures: boolean;
  onOpen: (algCase: AlgCase) => void;
}

/**
 * How the drill is going, under the clock while the next case waits: the
 * last few attempts across the set, each against that case's own ao5, and
 * today's count and mean. The case on the cube is never among what this says
 * about the one to come — it only looks back.
 *
 * A row opens the case's sheet, so a case that just went badly is a tap from
 * its algorithm.
 */
export function RecentAttempts({ run, cases, setId, skin, withPictures, onOpen }: RecentAttemptsProps) {
  if (run.recent.length === 0) return null;

  return (
    <section className="drill-run" aria-label={strings.drill.recentTitle}>
      <div className="drill-run__head">
        <h3 className="drill-run__title">{strings.drill.recentTitle}</h3>
        {/* "Today 0" over yesterday's attempts reads as if they were lost. */}
        {run.todayCount === 0 ? null : (
          <span className="drill-run__today">
            {strings.drill.recentToday(run.todayCount, formatAverage(run.todayMeanMs))}
          </span>
        )}
      </div>
      <ol className="drill-run__list">
        {run.recent.map((attempt) => {
          const algCase = cases.get(attempt.caseId);
          if (algCase === undefined) return null;
          const diagram = diagramFor(setId, algCase.group ?? '');
          const versus = attempt.versusAo5Ms;
          return (
            <li key={attempt.id}>
              <button type="button" className="drill-run__row" onClick={() => onOpen(algCase)}>
                {withPictures ? (
                  <CubeDiagram
                    className="drill-run__cube"
                    state={stateOf(algCase.setupAlg, diagram.orientation)}
                    view={diagram.view}
                    stickering={diagram.stickering}
                    skin={skin}
                    order={diagram.order}
                    label={null}
                  />
                ) : null}
                <span className="drill-run__name">{packLabel(caseTitle(algCase))}</span>
                <span className="drill-run__time">{formatResult(attempt.finalMs, attempt.penalty)}</span>
                <span
                  className={
                    versus === null
                      ? 'drill-run__versus'
                      : versus < 0
                        ? 'drill-run__versus is-faster'
                        : 'drill-run__versus is-slower'
                  }
                  title={versus === null ? undefined : strings.drill.recentVersus}
                >
                  {versus === null ? '' : formatDelta(versus)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
