import { useEffect, useState } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { TimerDisplay } from '../../../components/TimerDisplay';
import { formatAlg, parseAlg, type Move } from '../../../domain/cube/notation';
import { CROSS_HOLDS, crossSolutions, warmCrossSolver } from '../../../domain/cube/cross-solver';
import { CROSS_CASE_ID } from '../../../db/seed/packs';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import { withWhiteTop } from '../../../lib/cube-skins';
import { slowestCases, type CaseStats } from '../../../domain/drill/case-stats';
import type { Penalty } from '../../../db/types';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { diagramFor } from '../case-view';
import { stateOf, useAlgSets } from '../hooks/use-alg-cases';
import { useCaseStats } from '../hooks/use-case-stats';
import { useCaseAttempts } from '../hooks/use-case-attempts';
import { useDrill, type DrillItem, type DrillView, type StoredAttempt } from '../hooks/use-drill';
import { useTriggers } from '../hooks/use-triggers';
import { AlgText } from './AlgText';
import { AttemptActions, AttemptList } from './AttemptList';
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

  /**
   * Ticks of other sets are left alone — case ids say which set they are in.
   * Changing what is drilled starts a fresh attempt: the answer and the time
   * on the clock belong to the case that was on screen a moment ago.
   */
  const chooseHere = (ids: readonly string[]): void => {
    setSelectedIds([...selectedIds.filter((id) => !caseIds.includes(id)), ...ids]);
    drill.reset();
  };

  const status = drill.timer.state.status;
  const isSolving = status === 'running';
  const current = drill.current;

  // Building the solver's table takes about a tenth of a second, so it is
  // built while the user is still scrambling rather than while they wait for
  // an answer. Never during a solve: this runs on a set change, not per frame.
  useEffect(() => {
    if (drill.isCross) warmCrossSolver();
  }, [drill.isCross]);

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
                drill.reset();
              }}
            >
              {set.name}
            </button>
          ))}
        </div>

        {drill.isCross ? (
          <>
            {/* The cross is the one drill that inspects, so it is the one that
                needs the switch. It is the same switch as the timer screen's. */}
            <label className="toggle">
              <input
                type="checkbox"
                checked={drill.timer.inspectionEnabled}
                onChange={(event) => drill.timer.setInspectionEnabled(event.target.checked)}
              />
              {strings.timer.inspectionToggle}
            </label>
            <FrontPicker skin={skin} />
            <CrossHistory stats={stats?.get(CROSS_CASE_ID)} />
          </>
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
                <button
                  type="button"
                  className="drill__picker-done"
                  onClick={() => setPickerOpen(false)}
                >
                  {strings.drill.poolDone}
                </button>
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
              isCross={drill.isCross}
              stored={drill.stored}
              onJudge={drill.judge}
              onDiscard={drill.discard}
              onNext={drill.next}
            />
          ) : null}
          {drill.isRevealed ? null : (
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
  isCross: boolean;
  stored: StoredAttempt | null;
  onJudge: (penalty: Exclude<Penalty, 'none'>) => void;
  onDiscard: () => void;
  onNext: () => void;
}

/** What the case was, once the attempt can no longer benefit from knowing. */
function Answer({
  current,
  setId,
  skin,
  triggers,
  stats,
  gaveUp,
  isCross,
  stored,
  onJudge,
  onDiscard,
  onNext,
}: AnswerProps) {
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
      {isCross ? <CrossSolution scramble={current.scramble} /> : null}

      <CaseStatsRow stats={stats} />
      {/* The attempt is stored the moment the clock stops, so a dropped cube
          has to be fixable right here rather than hunted down later. */}
      {stored === null ? null : (
        <AttemptActions penalty={stored.penalty} onJudge={onJudge} onDelete={onDiscard} />
      )}

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

/** Indexable by any face; the four sides are the ones that can be in front. */
const COLOUR_NAMES: Record<string, string> = strings.drill.crossColours;

interface CrossSolutionProps {
  scramble: string;
}

/**
 * The shortest cross for the scramble that was just performed, written for
 * the cube as the reader is holding it.
 *
 * The cube can be picked up four ways with the cross face down, and the moves
 * differ for each — so rather than printing a rotation and hoping, the four
 * colours are on show and tapping one rewrites the solution. That also
 * explains the convention without a word of explanation.
 */
function CrossSolution({ scramble }: CrossSolutionProps) {
  const [front] = useSetting('trainer.crossFront');

  const parsed = parseAlg(scramble);
  const hold = CROSS_HOLDS.find((choice) => choice.front === front) ?? CROSS_HOLDS[0];
  const solutions =
    parsed.ok && hold !== undefined
      ? crossSolutions(applyAlg(applyAlg(solvedState(), parsed.moves), hold.rotation))
      : [];

  const [best, ...rest] = solutions;
  if (best === undefined) return null;

  return (
    <>
      <h3 className="drill__case-name">
        {strings.drill.crossSolution}
        {best.length === 0 ? '' : ` · ${best.length} ${strings.drill.crossMoves}`}
      </h3>
      {best.length === 0 ? (
        <p className="drill__hint">{strings.drill.crossSolved}</p>
      ) : (
        <>
          <p className="drill__moves">{formatAlg(best)}</p>
          {/* The others are the same length; which one suits your hands is
              exactly what there is to look at. */}
          {rest.length === 0 ? null : (
            <ul className="drill__alternatives">
              {rest.map((solution) => (
                <li key={formatAlg(solution)}>{formatAlg(solution)}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

/**
 * Which side is towards you. It sits with the scramble rather than with the
 * answer, because that is when you know: you read the scramble, put the cube
 * down cross-first and tap the colour you are looking at. The answer is then
 * already written for that grip — and tapping another colour after the fact
 * rewrites it, because this row is still on screen.
 */
function FrontPicker({ skin }: { skin: ReturnType<typeof useCubeSkin> }) {
  const [front, setFront] = useSetting('trainer.crossFront');
  // A scramble is performed with white on top, and these are its colours.
  const scrambleSkin = withWhiteTop(skin);

  return (
    <div className="drill__fronts">
      <span className="drill__hint">{strings.drill.crossFront}</span>
      {CROSS_HOLDS.map((choice) => (
        <button
          key={choice.front}
          type="button"
          className={choice.front === front ? 'drill__front is-active' : 'drill__front'}
          style={{ background: scrambleSkin.faces[choice.front] }}
          aria-label={COLOUR_NAMES[choice.front] ?? choice.front}
          aria-pressed={choice.front === front}
          onClick={() => setFront(choice.front)}
        />
      ))}
    </div>
  );
}

/**
 * Everything drilled on the cross, and the two things you might want to do to
 * it. Every other set keeps this in the case sheet, but the cross is not in
 * the trainer's list of sets — there is nothing there to read — so its
 * history lives where it is made.
 */
function CrossHistory({ stats }: { stats: CaseStats | undefined }) {
  const [isOpen, setOpen] = useState(false);
  const attempts = useCaseAttempts(CROSS_CASE_ID);

  if (attempts.attempts.length === 0) return null;

  return (
    <div className="drill__pool">
      <button
        type="button"
        className="drill__pool-toggle"
        aria-expanded={isOpen}
        onClick={() => setOpen((open) => !open)}
      >
        {strings.drill.attemptsTitle} {attempts.attempts.length}
      </button>

      {isOpen ? (
        <div className="drill__picker">
          <CaseStatsRow stats={stats} />
          <AttemptList
            attempts={attempts.attempts}
            onJudge={(id, penalty) =>
              watchWrite(() => attempts.changePenalty(id, penalty), strings.drill.judging)
            }
            onDelete={(id) => watchWrite(() => attempts.remove(id), strings.drill.discarding)}
            onDeleteAll={() => watchWrite(attempts.removeAll, strings.drill.discarding)}
          />
          <button type="button" className="drill__picker-done" onClick={() => setOpen(false)}>
            {strings.drill.poolDone}
          </button>
        </div>
      ) : null}
    </div>
  );
}
