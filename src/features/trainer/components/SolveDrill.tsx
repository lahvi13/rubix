import { useEffect, useState } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { ChevronIcon } from '../../../components/Icons';
import { TimerDisplay } from '../../../components/TimerDisplay';
import { formatAlg, parseAlg, type Move } from '../../../domain/cube/notation';
import { CROSS_HOLDS, crossSolutions, warmCrossSolver } from '../../../domain/cube/cross-solver';
import { CROSS_CASE_ID } from '../../../db/seed/packs';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import { withWhiteTop, type CubeSkin } from '../../../lib/cube-skins';
import { caseTitle } from '../../../domain/alg/case-name';
import type { CaseStats } from '../../../domain/drill/case-stats';
import type { Penalty } from '../../../db/types';
import type { DrillMode } from '../../../db/repositories/settings-repository';
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
import { CasePool } from './CasePool';
import { CaseStatsRow } from './CaseStats';
import { drillSummary } from '../drill-summary';
import { DrillLooks, DrillModes, DrillSets, DrillSetup } from './DrillControls';

interface SolveDrillProps {
  mode: DrillMode;
  onMode: (mode: DrillMode) => void;
}

/**
 * The drill: a case out of the chosen pool, a scramble that gets you to it,
 * and the same timer as a real solve. The name, the algorithm and the case's
 * own statistics stay hidden until the attempt is over — recognising the case
 * is half of what is being drilled.
 */
export function SolveDrill({ mode, onMode }: SolveDrillProps) {
  const sets = useAlgSets();
  const [setId, setSetId] = useSetting('trainer.drillSetId');
  const [selectedIds, setSelectedIds] = useSetting('trainer.drillCaseIds');
  const drill = useDrill(setId, selectedIds);
  const skin = useCubeSkin();
  const { definitions } = useTriggers();

  const caseIds = (drill.cases ?? []).map((entry) => entry.algCase.id);
  const stats = useCaseStats(caseIds);
  // The cross is one row in the case table only so that its attempts have
  // somewhere to live; there is nothing to tick, so nothing to count.
  const poolIds = drill.isCross ? [] : caseIds;

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
        <div className="drill__bar">
          <DrillSets
            sets={sets ?? []}
            setId={setId}
            onSet={(next) => {
              setSetId(next);
              drill.reset();
            }}
          />

          <DrillSetup summary={drillSummary(setId, mode, poolIds, selectedIds)}>
            <DrillLooks
              setId={setId}
              onSet={(next) => {
                setSetId(next);
                drill.reset();
              }}
            />
            <DrillModes mode={mode} onMode={onMode} />

            {drill.isCross ? (
              <>
                {/* The cross is the one drill that inspects, so it is the one
                    that needs the switch. Same switch as the timer screen's —
                    written out here, where the row is not fighting for width. */}
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={drill.timer.inspectionEnabled}
                    onChange={(event) => drill.timer.setInspectionEnabled(event.target.checked)}
                  />
                  {strings.timer.inspectionToggleLabel}
                </label>
                <CrossHistory stats={stats?.get(CROSS_CASE_ID)} />
              </>
            ) : (
              /* Changing what is drilled starts a fresh attempt: the answer and
                 the time on the clock belong to the case that was on screen a
                 moment ago. */
              <CasePool
                cases={drill.cases}
                selectedIds={selectedIds}
                stats={stats}
                onSelect={(ids) => {
                  setSelectedIds(ids);
                  drill.reset();
                }}
              />
            )}
          </DrillSetup>
        </div>

        <div className="drill__scramble">
          <ScrambleLine drill={drill} current={current} />
          {/* Only while there is still a cube to set up. Once the answer is
              up, the picture has done its job and the screen needs the room
              for the solution — this one has no scroll to fall back on. */}
          {drill.isCross && !drill.isRevealed ? (
            <ScrambleCube scramble={current?.scramble ?? ''} skin={skin} />
          ) : null}
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

/**
 * The scrambled cube, drawn where it is held while the scramble is performed:
 * white on top, green in front. It is the answer to "which way up do I start",
 * which the cross is the only drill that has to ask — every other set is set
 * up from a case, and a picture of it would be the answer to the question the
 * drill is asking.
 *
 * Follows the timer's own switch, so somebody who has turned scramble pictures
 * off does not get one here; the hint under the moves says the same in words.
 */
function ScrambleCube({ scramble, skin }: { scramble: string; skin: CubeSkin }) {
  const [mode] = useSetting('ui.twistyMode');
  const [isPreviewShown] = useSetting('timer.showScramblePreview');
  const parsed = parseAlg(scramble);
  if (!isPreviewShown || !parsed.ok) return null;

  return (
    <CubeDiagram
      className="drill__scramble-cube"
      state={applyAlg(solvedState(), parsed.moves)}
      view={mode === '3D' ? 'isometric' : 'net'}
      skin={withWhiteTop(skin)}
      label={strings.drill.crossSetup}
    />
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
  const title = caseTitle(current.algCase);

  return (
    <>
      <h2 className="drill__case-name">{title}</h2>
      {gaveUp ? <p className="drill__hint">{strings.drill.gaveUp}</p> : null}

      {moves.length === 0 ? null : (
        <CubeDiagram
          className="drill__diagram"
          state={stateOf(current.algCase.setupAlg)}
          view={diagram.view}
          stickering={diagram.stickering}
          skin={skin}
          label={title}
        />
      )}
      {moves.length === 0 ? null : <AlgText moves={moves} triggers={triggers} />}
      {isCross ? <CrossSolution scramble={current.scramble} skin={skin} /> : null}

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
  skin: CubeSkin;
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
function CrossSolution({ scramble, skin }: CrossSolutionProps) {
  const [front, setFront] = useSetting('trainer.crossFront');

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
      <FrontPicker skin={skin} front={front} onFront={setFront} />
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

interface FrontPickerProps {
  skin: CubeSkin;
  front: string;
  onFront: (front: string) => void;
}

/**
 * Which side is towards you. It belongs to the solution and sits with it: the
 * only thing it changes is how those moves are written, and above the scramble
 * it read as a claim about the orientation the scramble itself starts from —
 * which is a different question, and one the picture up there answers.
 */
function FrontPicker({ skin, front, onFront }: FrontPickerProps) {
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
          onClick={() => onFront(choice.front)}
        />
      ))}
      <p className="drill__hint drill__fronts-hint">{strings.drill.crossFrontHint}</p>
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
        <span>
          {strings.drill.attemptsTitle} {attempts.attempts.length}
        </span>
        <ChevronIcon up={isOpen} />
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
