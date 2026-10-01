import { useEffect, useRef, useState } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { ChevronIcon } from '../../../components/Icons';
import { PlaybackButtons } from '../../../components/PlaybackButtons';
import { TimerDisplay } from '../../../components/TimerDisplay';
import { useHasKeyboard } from '../../../hooks/use-has-keyboard';
import { formatAlg, parseAlg, type Move, type MoveGroup } from '../../../domain/cube/notation';
import { CROSS_HOLDS, crossSolutions, warmCrossSolver } from '../../../domain/cube/cross-solver';
import { CROSS_CASE_ID } from '../../../domain/alg/sets';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import type { CubeSkin } from '../../../lib/cube-skins';
import { caseTitle } from '../../../domain/alg/case-name';
import type { CaseStats } from '../../../domain/drill/case-stats';
import type { Penalty } from '../../../db/types';
import type { DrillMode } from '../../../db/repositories/settings-repository';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { usePlayWhenDrawn } from '../../../hooks/use-play-when-drawn';
import {
  usePlayback,
  type PlaybackPosition,
  type PlaybackRequest,
} from '../../../hooks/use-playback';
import { usePlayingMove } from '../../../hooks/use-playing-move';
import { usePlaybackKeys } from '../../../hooks/use-playback-keys';
import { useTap } from '../../../hooks/use-tap';
import { useTwistySkin } from '../../../hooks/use-twisty-skin';
import { CAMERA_LATITUDE, CAMERA_LONGITUDE, CUBE_ORIENTATION } from '../../../lib/twisty-view';
import type { TwistyPlayerElement } from '../../../types/twisty';
import { useSetting } from '../../../hooks/use-setting';
import { watchWrite } from '../../../lib/errors';
import { packLabel, strings } from '../../../lib/strings';
import { diagramFor } from '../case-view';
import { stateOf, useAlgSets } from '../hooks/use-alg-cases';
import { useCaseAttempts } from '../hooks/use-case-attempts';
import { useDrill, type DrillItem, type DrillView, type StoredAttempt } from '../hooks/use-drill';
import { useTriggers } from '../hooks/use-triggers';
import { AlgText } from './AlgText';
import { AttemptActions, AttemptList } from './AttemptList';
import { CasePlayer } from './CasePlayer';
import { CasePool } from './CasePool';
import { CaseStatsRow } from './CaseStats';
import { drillSummary } from '../drill-summary';
import { DrillLevels, DrillLooks, DrillModes, DrillSets, DrillSetup } from './DrillControls';
import { DrillStage } from './DrillStage';

interface SolveDrillProps {
  mode: DrillMode;
  onMode: (mode: DrillMode) => void;
  /** False for the cross, which has no case to name and so no switch. */
  canRecognise: boolean;
}

/**
 * The drill: a case out of the chosen pool, a scramble that gets you to it,
 * and the same timer as a real solve. The name, the algorithm and the case's
 * own statistics stay hidden until the attempt is over — recognising the case
 * is half of what is being drilled.
 */
export function SolveDrill({ mode, onMode, canRecognise }: SolveDrillProps) {
  const sets = useAlgSets();
  const [setId, setSetId] = useSetting('trainer.drillSetId');
  const [selectedIds, setSelectedIds] = useSetting('trainer.drillCaseIds');
  const drill = useDrill(setId, selectedIds);
  const skin = useCubeSkin();
  const { definitions } = useTriggers();

  const caseIds = (drill.cases ?? []).map((entry) => entry.algCase.id);
  const { stats } = drill;
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
    <main className="screen screen--scroll screen--drill">
      <div className={isSolving ? 'drill__setup is-hidden' : 'drill__setup'}>
        <div className="drill__bar">
          <DrillModes mode={mode} onMode={onMode} canRecognise={canRecognise} />
          <DrillSets
            sets={sets ?? []}
            setId={setId}
            onSet={(next) => {
              setSetId(next);
              drill.reset();
            }}
          />

          <DrillSetup
            summary={drillSummary(
              setId,
              poolIds,
              selectedIds,
              drill.timer.inspectionEnabled,
            )}
          >
            <DrillLevels
              setId={setId}
              onSet={(next) => {
                setSetId(next);
                drill.reset();
              }}
            />
            <DrillLooks
              setId={setId}
              onSet={(next) => {
                setSetId(next);
                drill.reset();
              }}
            />

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
          {/* Stays up once the attempt is over, rather than making room for the
              answer: the page scrolls now, and a picture that vanished at the
              moment the clock stopped took the clock 150px up the screen with
              it. It is also the cube the animation below starts from. */}
          {drill.isCross ? (
            <CrossSetup
              scramble={current?.scramble ?? ''}
              skin={skin}
              /* Said once, to somebody who has not drilled the cross before:
                 after the first attempt the cube is already where the next
                 scramble expects it, and the line would be telling them to do
                 what they have just done. */
              isFirstTime={stats !== undefined && stats.get(CROSS_CASE_ID) === undefined}
            />
          ) : null}
        </div>
      </div>

      <TimerDisplay
        state={drill.timer.state}
        displayMs={drill.timer.displayMs}
        inspectionMs={drill.timer.inspectionMs}
        armed={drill.timer.armed}
        inspectionEnabled={drill.timer.inspectionEnabled}
        locked={drill.timer.isLocked}
        touchHandlers={drill.timer.touchHandlers}
      />

      {/* Mid-solve nobody aims for the numbers: any tap must stop the clock,
          and the release after it is swallowed here too. Once the answer is up
          it comes off, or it would sit over the buttons that judge the attempt
          while refusing to do anything itself. */}
      {!drill.timer.isLocked && (status === 'running' || status === 'stopped') ? (
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

/**
 * What to perform before the attempt, or why there is nothing to perform.
 *
 * A case's scramble arrives a moment after the case, from the solver; the
 * cross is drawn on the spot. Otherwise the only ways to have nothing to show
 * are a set still loading and a case whose setup does not parse.
 */
function ScrambleLine({ drill, current }: ScrambleLineProps) {
  const hasKeyboard = useHasKeyboard();
  if (drill.cases === undefined) return <p className="drill__hint">{strings.trainer.loading}</p>;
  if (current === null) return <p className="drill__hint">{strings.drill.empty}</p>;
  if (current.scramble === null) return <p className="drill__hint">{strings.scramble.loading}</p>;
  if (current.scramble === '') {
    return <p className="drill__hint">{strings.drill.empty}</p>;
  }

  return (
    <>
      <p className="drill__moves">{current.scramble}</p>
      <p className="drill__hint">
        {drill.isCross
          ? hasKeyboard
            ? strings.drill.crossHintKeys
            : strings.drill.crossHint
          : hasKeyboard
            ? strings.drill.caseHintKeys
            : strings.drill.caseHint}
      </p>
    </>
  );
}

/**
 * How the cross is held, and what it looks like once the scramble is on it.
 *
 * Both belong here rather than with the answer. The drill no longer starts
 * from a solved cube — it starts from a solved cross, which is the state every
 * attempt leaves behind — so the grip is a standing fact about how the reader
 * works, not something they report afterwards: it decides which colours the
 * picture wears, and the picture is read before the attempt, not after it.
 *
 * The picture claims only the cross edges and the centres, because that is all
 * the drill knows and all the cross needs. The rest of the reader's cube is
 * whatever the last attempt left there, and drawing it would be an invention.
 */
function CrossSetup({
  scramble,
  skin,
  isFirstTime,
}: {
  scramble: string;
  skin: CubeSkin;
  isFirstTime: boolean;
}) {
  const [front, setFront] = useSetting('trainer.crossFront');
  const [mode] = useSetting('ui.twistyMode');
  const [isPreviewShown] = useSetting('timer.showScramblePreview');

  const parsed = parseAlg(scramble);
  const hold = CROSS_HOLDS.find((choice) => choice.front === front) ?? CROSS_HOLDS[0];

  return (
    <>
      {isFirstTime ? <p className="drill__hint">{strings.drill.crossFirst}</p> : null}
      <FrontPicker skin={skin} front={front} onFront={setFront} />
      {!isPreviewShown || !parsed.ok || hold === undefined ? null : (
        <CubeDiagram
          className="drill__scramble-cube"
          state={applyAlg(applyAlg(solvedState(), parsed.moves), hold.rotation)}
          view={mode === '3D' ? 'isometric' : 'net'}
          stickering="cross"
          skin={skin}
          label={strings.drill.crossSetup}
        />
      )}
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
  const { moves, groups } = movesOf(current.algorithm?.moves ?? '');
  const title = packLabel(caseTitle(current.algCase));

  // Played from the case as the picture draws it, not from the scramble: the
  // algorithm below is written for that picture, with no AUF in front.
  const alg = formatAlg(moves);
  const playback = usePlayback(`${current.algCase.id} ${current.scramble ?? ''} ${alg}`);
  const [playingMove, setPlayingMove] = useState<number | null>(null);
  const isPlaying = playback.status !== 'idle';
  // Space is the drill timer's.
  usePlaybackKeys(playback, { isActive: true, withSpace: false });

  const next = (
    <button type="button" className="is-primary" onClick={onNext}>
      {strings.drill.next}
    </button>
  );
  const picture = (
    <CubeDiagram
      className="drill__cube"
      state={stateOf(current.algCase.setupAlg, diagram.orientation)}
      view={diagram.view}
      stickering={diagram.stickering}
      skin={skin}
      label={title}
    />
  );

  return (
    <>
      <h2 className="drill__case-name">{title}</h2>
      {gaveUp ? <p className="drill__hint">{strings.drill.gaveUp}</p> : null}

      {moves.length === 0 ? null : (
        <DrillStage end={next} canPlay playback={playback}>
          {isPlaying ? (
            <CasePlayer
              // The rotation is part of the setup, so the cube that replaces
              // the picture stands the same way round.
              setupAlg={`${diagram.orientation} ${current.algCase.setupAlg}`}
              alg={alg}
              stickering={diagram.playerStickering}
              request={playback.request}
              onMove={setPlayingMove}
              onStopped={playback.stopped}
              placeholder={picture}
            />
          ) : (
            picture
          )}
        </DrillStage>
      )}
      {moves.length === 0 ? null : (
        <AlgText
          moves={moves}
          groups={groups}
          triggers={triggers}
          onPlay={playback.restart}
          playLabel={strings.trainer.play}
          playingMove={isPlaying ? playingMove : null}
        />
      )}
      {isCross ? <CrossSolution scramble={current.scramble ?? ''} /> : null}

      <CaseStatsRow stats={stats} />
      {/* The attempt is stored the moment the clock stops, so a dropped cube
          has to be fixable right here rather than hunted down later. */}
      {stored === null ? null : (
        <AttemptActions
          penalty={stored.penalty}
          onJudge={onJudge}
          onDelete={onDiscard}
          judgeable={!gaveUp}
        />
      )}

      {/* Without a case picture — the cross — there is nothing to stand beside. */}
      {moves.length === 0 ? next : null}
    </>
  );
}

function movesOf(text: string): { moves: Move[]; groups: MoveGroup[] } {
  const parsed = parseAlg(text);
  return parsed.ok ? { moves: parsed.moves, groups: parsed.groups } : { moves: [], groups: [] };
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
  // Once asked for, the cube stays: played to the end it shows the cross
  // built, which is worth looking at, and the next play starts it over.
  const [isWatched, setWatched] = useState(false);
  const playback = usePlayback();
  const tap = useTap(playback.toggle);
  // Space is the drill timer's.
  usePlaybackKeys(playback, { isActive: isWatched, withSpace: false });
  const [playingMove, setPlayingMove] = useState<number | null>(null);
  /** Which of the shortest solutions is the one on show and on the cube. */
  const [chosen, setChosen] = useState(0);
  const [chosenFor, setChosenFor] = useState(front);

  const parsed = parseAlg(scramble);
  const hold = CROSS_HOLDS.find((choice) => choice.front === front) ?? CROSS_HOLDS[0];
  const solutions =
    parsed.ok && hold !== undefined
      ? crossSolutions(applyAlg(applyAlg(solvedState(), parsed.moves), hold.rotation))
      : [];

  // Turning the cube round rewrites every solution, so the one that was picked
  // out of the old set does not exist in the new one. Adjusted during render
  // rather than in an effect: this is state that no longer matches what it was
  // derived from, and an effect would paint the stale choice first.
  if (chosenFor !== front) {
    setChosenFor(front);
    setChosen(0);
    if (isWatched) playback.restart();
  }

  const best = solutions[chosen] ?? solutions[0];
  if (best === undefined || hold === undefined) return null;
  const others = solutions.filter((_, index) => index !== chosen);

  return (
    <>
      <h3 className="drill__case-name">
        {strings.drill.crossSolution}
        {best.length === 0 ? '' : ` · ${strings.drill.crossMoves(best.length)}`}
      </h3>
      {best.length === 0 ? (
        <p className="drill__hint">{strings.drill.crossSolved}</p>
      ) : (
        <>
          {/* The cube picks up where the reader's did: scrambled, then turned
              round into the grip they said they were using, so the moves below
              mean on screen exactly what they mean in their hands. */}
          {isWatched ? (
            <div className="drill__cross-stage" {...tap}>
              <CrossPlayer
                setupAlg={`${scramble} ${formatAlg(hold.rotation)}`}
                alg={formatAlg(best)}
                request={playback.request}
                onMove={setPlayingMove}
                onStopped={playback.stopped}
              />
              <PlaybackButtons
                status={playback.status}
                onToggle={playback.toggle}
                onStep={playback.step}
                onBack={playback.back}
                position={playback.position}
                placement="corners"
              />
            </div>
          ) : null}
          {/* Played through, the cube stays on the cross it built, but no move
              of it is still under way. */}
          <p className="drill__moves">
            {formatAlg(best)
              .split(' ')
              .map((move, index) => (
                <span
                  key={index + move}
                  aria-current={
                    playback.status !== 'idle' && index === playingMove ? 'step' : undefined
                  }
                >
                  {move + ' '}
                </span>
              ))}
          </p>
          <button
            type="button"
            onClick={() => {
              setWatched(true);
              playback.restart();
            }}
          >
            {isWatched ? strings.drill.crossWatchAgain : strings.drill.crossWatch}
          </button>
          {/*
            The others are the same length; which one suits your hands is
            exactly what there is to look at, and reading five moves is not the
            same as seeing them. So each one takes the place of the solution
            above when it is tapped — and the cube, already set up and already
            watching that line, simply performs the new one.
          */}
          {others.length === 0 ? null : (
            <ul className="drill__alternatives" aria-label={strings.drill.crossAlternatives}>
              {others.map((solution) => (
                <li key={formatAlg(solution)}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(solutions.indexOf(solution));
                      if (isWatched) playback.restart();
                    }}
                  >
                    {formatAlg(solution)}
                  </button>
                </li>
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
 * Which side you keep towards you. It governs the picture and the solution
 * alike, so it sits with the picture — the one of the two that is read before
 * the attempt rather than after it.
 *
 * Named for the four sides of the cube as it was scrambled — cross down, the
 * way it is held throughout, so the app's own colours are the ones on it.
 */
function FrontPicker({ skin, front, onFront }: FrontPickerProps) {
  return (
    <div className="drill__fronts">
      <span className="drill__hint">{strings.drill.crossFront}</span>
      {CROSS_HOLDS.map((choice) => (
        <button
          key={choice.front}
          type="button"
          className={choice.front === front ? 'drill__front is-active' : 'drill__front'}
          style={{ background: skin.faces[choice.front] }}
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

interface CrossPlayerProps {
  /** The scramble and the turn onto the cross face, as one setup. */
  setupAlg: string;
  alg: string;
  /** What the buttons last asked the cube to do. */
  request: PlaybackRequest;
  onMove: (index: number | null) => void;
  onStopped: (at: PlaybackPosition) => void;
}

/**
 * The cross being solved, on a cube that turns.
 *
 * Watched from underneath, which no other player in the app does: the cross is
 * built on the face the cube is standing on, and from the usual angle it is the
 * one face you cannot see. It is the same look a reader gets by tilting the
 * cube to check their work.
 *
 * It only arrives when somebody asks for it, chunk and all.
 */
function CrossPlayer({ setupAlg, alg, request, onMove, onStopped }: CrossPlayerProps) {
  const player = useRef<TwistyPlayerElement | null>(null);
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import('cubing/twisty').then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  usePlayingMove(player, isReady, onMove, onStopped);
  // From below, the cross is the face the light leaves darkest. Half the shade
  // still says which face is the bottom, and leaves white looking white.
  useTwistySkin(player, isReady, { shadeStrength: 0.5 });
  // Nothing to hide behind here, so the cube shows at once, held at the start.
  usePlayWhenDrawn(player, isReady, request);

  if (!isReady) return <p className="case-player__loading">{strings.trainer.loadingPlayer}</p>;

  return (
    <twisty-player
      ref={player}
      className="case-player"
      // Dragging this turns the cube; without it a drag would scroll the page
      // out from under the thing being watched.
      data-no-swipe=""
      puzzle="3x3x3"
      alg={alg}
      /* Stood on its head first, like every other player here: cubing.js
         starts a cube white on top, and the drill's moves are written for the
         cube the app models — yellow up, the cross on the bottom. */
      experimental-setup-alg={`${CUBE_ORIENTATION} ${setupAlg}`}
      experimental-setup-anchor="start"
      visualization="3D"
      background="none"
      camera-latitude={-CAMERA_LATITUDE}
      camera-longitude={CAMERA_LONGITUDE}
      control-panel="none"
      hint-facelets="none"
    />
  );
}
