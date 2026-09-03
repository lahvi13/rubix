import { useState } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { TimerDisplay } from '../../../components/TimerDisplay';
import { parseAlg, type Move } from '../../../domain/cube/notation';
import { slowestCases, type CaseStats } from '../../../domain/drill/case-stats';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import { strings } from '../../../lib/strings';
import { diagramFor } from '../case-view';
import { stateOf, useAlgSets } from '../hooks/use-alg-cases';
import { useCaseStats } from '../hooks/use-case-stats';
import { useDrill, type DrillItem, type DrillView } from '../hooks/use-drill';
import { useTriggers } from '../hooks/use-triggers';
import { AlgText } from './AlgText';
import { CaseStatsRow } from './CaseStats';

/**
 * The drill: a case out of the chosen pool, a scramble that gets you to it,
 * and the same timer as a real solve. The name, the algorithm and the case's
 * own statistics stay hidden until the attempt is over — recognising the case
 * is half of what is being drilled.
 */
export function DrillScreen() {
  const sets = useAlgSets();
  const [setId, setSetId] = useSetting('trainer.drillSetId');
  const [selectedIds, setSelectedIds] = useSetting('trainer.drillCaseIds');
  const drill = useDrill(setId, selectedIds);
  const skin = useCubeSkin();
  const { definitions } = useTriggers();
  const [isPickerOpen, setPickerOpen] = useState(false);

  const caseIds = (drill.cases ?? []).map((entry) => entry.algCase.id);
  const stats = useCaseStats(caseIds);
  const tickedHere = caseIds.filter((id) => selectedIds.includes(id));

  /** Ticks of other sets are left alone — case ids say which set they are in. */
  const chooseHere = (ids: readonly string[]): void => {
    setSelectedIds([...selectedIds.filter((id) => !caseIds.includes(id)), ...ids]);
  };

  const status = drill.timer.state.status;
  const isSolving = status === 'running';
  const current = drill.current;

  return (
    <main className="screen">
      <div className={isSolving ? 'drill__setup is-hidden' : 'drill__setup'}>
        <div className="trainer__sets">
          {(sets ?? []).map((set) => (
            <button
              key={set.id}
              type="button"
              className={set.id === setId ? 'is-active' : ''}
              onClick={() => {
                setSetId(set.id);
                setPickerOpen(false);
              }}
            >
              {set.name}
            </button>
          ))}
        </div>

        {drill.isCross ? (
          // The cross is the one drill that inspects, so it is the one that
          // needs the switch. It is the same switch as the timer screen's.
          <label className="toggle">
            <input
              type="checkbox"
              checked={drill.timer.inspectionEnabled}
              onChange={(event) => drill.timer.setInspectionEnabled(event.target.checked)}
            />
            {strings.timer.inspectionToggle}
          </label>
        ) : (
          <div className="drill__pool">
            <button
              type="button"
              className="drill__pool-toggle"
              aria-expanded={isPickerOpen}
              onClick={() => setPickerOpen((open) => !open)}
            >
              {strings.drill.pool} {tickedHere.length === 0 ? caseIds.length : tickedHere.length}
              {' / '}
              {caseIds.length}
            </button>

            {isPickerOpen ? (
              <div className="drill__picker">
                <div className="drill__picker-actions">
                  <button type="button" onClick={() => chooseHere(caseIds)}>
                    {strings.drill.poolAll}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      chooseHere(
                        slowestCases([...(stats?.values() ?? [])]).map((entry) => entry.caseId),
                      )
                    }
                  >
                    {strings.drill.poolSlowest}
                  </button>
                </div>
                <p className="drill__hint">{strings.drill.poolHint}</p>
                <div className="drill__chips">
                  {(drill.cases ?? []).map((entry) => (
                    <label key={entry.algCase.id} className="drill__chip">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(entry.algCase.id)}
                        onChange={(event) =>
                          chooseHere(
                            event.target.checked
                              ? [...tickedHere, entry.algCase.id]
                              : tickedHere.filter((id) => id !== entry.algCase.id),
                          )
                        }
                      />
                      {entry.algCase.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="drill__scramble">
          <ScrambleLine drill={drill} current={current} />
        </div>
      </div>

      <TimerDisplay
        state={drill.timer.state}
        displayMs={drill.timer.displayMs}
        inspectionMs={drill.timer.inspectionMs}
        armed={drill.timer.armed}
        inspectionEnabled={drill.timer.inspectionEnabled}
        touchHandlers={drill.timer.touchHandlers}
      />

      {/* Mid-solve nobody aims for the numbers: any tap must stop the clock,
          and the release after it is swallowed here too. */}
      {status === 'running' || status === 'stopped' ? (
        <div className="timer-overlay" aria-hidden="true" {...drill.timer.touchHandlers} />
      ) : null}

      {isSolving || current === null ? null : (
        <section className="drill__answer">
          {drill.isRevealed ? (
            <Answer
              current={current}
              setId={setId}
              skin={skin}
              triggers={definitions}
              stats={stats?.get(current.algCase.id)}
              gaveUp={drill.gaveUp}
              onNext={drill.next}
            />
          ) : (
            <button type="button" className="drill__give-up" onClick={drill.reveal}>
              {strings.drill.showCase}
            </button>
          )}
        </section>
      )}
    </main>
  );
}

interface ScrambleLineProps {
  drill: DrillView;
  current: DrillItem | null;
}

/** What to perform before the attempt, or why there is nothing to perform. */
function ScrambleLine({ drill, current }: ScrambleLineProps) {
  if (drill.scrambleError !== null) {
    return <p className="drill__hint">{strings.scramble.failed}</p>;
  }
  if (drill.cases === undefined) return <p className="drill__hint">{strings.trainer.loading}</p>;
  if (current === null) return <p className="drill__hint">{strings.drill.empty}</p>;
  if (current.scramble === '') {
    return <p className="drill__hint">{strings.scramble.loading}</p>;
  }

  return (
    <>
      <p className="drill__moves">{current.scramble}</p>
      <p className="drill__hint">
        {drill.isCross ? strings.drill.crossHint : strings.drill.caseHint}
      </p>
    </>
  );
}

interface AnswerProps {
  current: DrillItem;
  setId: string;
  skin: ReturnType<typeof useCubeSkin>;
  triggers: ReturnType<typeof useTriggers>['definitions'];
  stats: CaseStats | undefined;
  gaveUp: boolean;
  onNext: () => void;
}

/** What the case was, once the attempt can no longer benefit from knowing. */
function Answer({ current, setId, skin, triggers, stats, gaveUp, onNext }: AnswerProps) {
  const diagram = diagramFor(setId, current.algCase.group ?? '');
  const moves = movesOf(current.algorithm?.moves ?? '');

  return (
    <>
      <h2 className="drill__case-name">{current.algCase.name}</h2>
      {gaveUp ? <p className="drill__hint">{strings.drill.gaveUp}</p> : null}

      {moves.length === 0 ? null : (
        <CubeDiagram
          className="drill__diagram"
          state={stateOf(current.algCase.setupAlg)}
          view={diagram.view}
          stickering={diagram.stickering}
          skin={skin}
          label={current.algCase.name}
        />
      )}
      {moves.length === 0 ? null : <AlgText moves={moves} triggers={triggers} />}

      <CaseStatsRow stats={stats} />

      <button type="button" className="result-bar__next" onClick={onNext}>
        {strings.drill.next}
      </button>
    </>
  );
}

function movesOf(text: string): Move[] {
  const parsed = parseAlg(text);
  return parsed.ok ? parsed.moves : [];
}
