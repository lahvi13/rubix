import { useCallback, useMemo, useState } from 'react';
import type { MethodPhase, Penalty } from '../../../db/types';
import { addSolve } from '../../../db/repositories/solve-repository';
import { bestPhasesIn } from '../../../domain/stats/phases';
import { resultRecord, type ResultRecord } from '../../../domain/stats/records';
import { now } from '../../../lib/clock';
import { strings } from '../../../lib/strings';
import { reportError } from '../../../lib/errors';
import { SolveDetailSheet } from '../../history';
import { SessionPicker, useActiveSession } from '../../sessions';
import { PhaseBar, PhaseRun, usePhases } from '../../splits';
import { MiniStats } from '../../stats';
import { useRecentSolves } from '../hooks/use-recent-solves';
import { useSheetMotion } from '../hooks/use-sheet-motion';
import { useScramble } from '../../../hooks/use-scramble';
import { useBackToClose } from '../../../hooks/use-back-to-close';
import { usePull } from '../../../hooks/use-pull';
import { useSessionRecords } from '../../../hooks/use-session-records';
import { useSetting } from '../../../hooks/use-setting';
import { useTimer, type CompletedAttempt } from '../../../hooks/use-timer';
import { ScramblePanel } from './ScramblePanel';
import { SolveList } from './SolveList';
import { TimerDisplay, type RecordNote } from '../../../components/TimerDisplay';

const PUZZLE = '333';
const MODE = 'freestyle';
const EMPTY_PHASES: never[] = [];

/**
 * A record put into words. The phase tier is the only one that needs the
 * method: `resultRecord` deals in phase keys, and nobody wants to read one.
 */
function noteFor(record: ResultRecord, phases: readonly MethodPhase[]): RecordNote {
  if (record.kind === 'pb') return { tier: 'pb', label: strings.timer.recordPb };
  if (record.kind === 'session') return { tier: 'session', label: strings.timer.recordSession };
  const named = record.phases.map(
    (key) => phases.find((phase) => phase.key === key)?.label ?? key,
  );
  return {
    tier: 'phase',
    label: strings.timer.recordPhases(named.join(strings.timer.recordPhaseJoin)),
  };
}

export function TimerScreen() {
  const session = useActiveSession(PUZZLE, MODE);
  const scramble = useScramble(PUZZLE);
  const { solves, changePenalty, remove } = useRecentSolves(session?.id ?? null);
  const [splitMode, setSplitMode] = useSetting('timer.splitMode');
  const methodPhases = usePhases(session?.methodId ?? null);

  // Empty means the plain timer. The phases come from the session's method,
  // never from a list in the code (SPEC 3.6).
  const phases = splitMode === 'phases' ? methodPhases : EMPTY_PHASES;
  const phaseKeys = useMemo(() => phases.map((phase) => phase.key), [phases]);
  // After a solve the screen shows the result, not the next scramble; the
  // user moves on explicitly (or just starts the next attempt).
  const [showResult, setShowResult] = useState(false);
  // The list, pulled up over the cube to be read. Any touch of the timer ends
  // it, so there is no way to be browsing and solving at once.
  const [isBrowsing, setBrowsing] = useState(false);

  const handleComplete = useCallback(
    (attempt: CompletedAttempt) => {
      setShowResult(true);
      /*
       * And the list goes back down, if it was up. On a phone there is
       * nothing to start an attempt with while it is up — the clock is
       * clipped away — but the space bar reaches the timer from anywhere, and
       * the list used to come back over the finished time the moment the
       * clock stopped, hiding the result, what record it was, and the way on
       * to the next scramble. An attempt that is abandoned rather than
       * finished leaves the reader where they were, which is why this is here
       * and not on the press.
       */
      setBrowsing(false);

      if (!session) {
        // Losing a solve silently is worse than any other failure here.
        reportError(strings.errors.saveSolve, new Error(strings.errors.noSession));
        return;
      }

      void addSolve({
        sessionId: session.id,
        puzzle: PUZZLE,
        mode: MODE,
        // A missing scramble must not cost the user the time itself.
        scramble: scramble.scramble ?? '',
        rawMs: attempt.rawMs,
        penalty: attempt.penalty,
        // Anything set at this point came from the inspection rules, not the user.
        penaltySource: 'auto',
        inspectionMs: attempt.inspectionMs,
        startedAt: now() - Math.round(attempt.rawMs),
        splits: attempt.splitMs.map((atMs, index) => ({
          phase: phaseKeys[index] ?? '',
          atMs: Math.round(atMs),
          source: 'manual' as const,
        })),
        phaseKeys,
      })
        .then(() => {
          scramble.next();
        })
        .catch((cause: unknown) => {
          reportError(strings.errors.saveSolve, cause);
        });
    },
    [session, scramble, phaseKeys],
  );

  const timer = useTimer(handleComplete, { phases: phaseKeys });
  const status = timer.state.status;
  /*
   * From the first touch until the time is read: inspection, the hold, the
   * solve. The scramble has been performed by then and the list is not being
   * read, so the clock gets the screen — and nothing else can be under it.
   */
  const isEngaged = status === 'inspecting' || status === 'holding' || status === 'running';
  // Which solve is open in the detail sheet, if any.
  const [openSolveId, setOpenSolveId] = useState<string | null>(null);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const openableSolves = useMemo(() => solves.map((solve) => solve.id), [solves]);
  // From the method's phases, not the timer's: `phaseKeys` above is empty
  // unless phase timing is switched on, while the list below draws the bars
  // of every solve that has them. Asked with the wrong keys, the records come
  // back without phases and nothing is ever marked.
  const listedPhaseKeys = useMemo(
    () => methodPhases.map((phase) => phase.key),
    [methodPhases],
  );
  const records = useSessionRecords(session?.id ?? null, PUZZLE, listedPhaseKeys);
  const showBrowsing = isBrowsing && status === 'idle';
  const { panel: sheetPanel, slot: sheetSlot, isSheet } = useSheetMotion(
    showBrowsing,
    status === 'idle',
  );

  // Derived, not synchronized: the result stays up only while the machine is
  // at rest with a finished time. Starting the next attempt (or cancelling,
  // which wipes lastRawMs) hides it without any bookkeeping.
  const resultVisible =
    showResult &&
    (status === 'stopped' || (timer.state.status === 'idle' && timer.state.lastRawMs !== null));

  /*
   * The solve the clock is showing, which is not simply the newest one: the
   * list is a live query and the attempt has to be written before it arrives,
   * so for a moment after the clock stops the newest row is still the solve
   * before this one. Anything drawn under the time — its phases, what record
   * it holds — would be describing that one.
   */
  const clockRawMs =
    timer.state.status === 'stopped'
      ? timer.state.rawMs
      : timer.state.status === 'idle'
        ? timer.state.lastRawMs
        : null;
  const lastSolve = solves[0];
  const shownSolve =
    resultVisible && lastSolve && clockRawMs !== null && lastSolve.rawMs === Math.round(clockRawMs)
      ? lastSolve
      : null;

  // What that time turned out to be worth. Read from records that already
  // count it, so a solve that has just become the best IS the best.
  const record = useMemo(
    () =>
      shownSolve === null
        ? null
        : resultRecord(shownSolve, listedPhaseKeys, records.bests, records.globalPbMs),
    [shownSolve, listedPhaseKeys, records],
  );
  const recordNote = useMemo(
    () => (record === null ? null : noteFor(record, methodPhases)),
    [record, methodPhases],
  );
  // The same ring the lists draw round a phase that is the fastest it has
  // been, on the bar of the solve that just happened.
  const shownBestPhases = useMemo(
    () =>
      shownSolve === null ? [] : bestPhasesIn(shownSolve, listedPhaseKeys, records.bests),
    [shownSolve, listedPhaseKeys, records],
  );

  // Stable references, or the memo on SolveList would be defeated by the
  // per-frame re-renders while the timer is live.
  const handleChangePenalty = useCallback(
    (id: string, penalty: Penalty) => void changePenalty(id, penalty),
    [changePenalty],
  );
  const handleDelete = useCallback((id: string) => void remove(id), [remove]);
  // Stable, or the memo on SolveList is defeated.
  const handleListExpanded = useCallback(() => setBrowsing(true), []);
  const handleListCollapsed = useCallback(() => setBrowsing(false), []);

  /*
   * Both ways the list is dragged. Up while it is down, down from the grip
   * while it is up — and never a scroll either way, which is why the list
   * does not scroll while it is down (see `.solves` in the stylesheet).
   *
   * That is not a preference. A touch the browser has taken for a scroll
   * grants no user activation at any point of itself, the finger lifting
   * included, and Chrome marks a history entry pushed without activation as
   * one to skip — so the back press that should have put the list away went
   * straight out of the app instead. Measured: every event of a scroll flick
   * reports `navigator.userActivation.isActive === false`, while a drag on
   * the grip reports true on pointerup.
   */
  const pullUp = usePull('up', handleListExpanded);
  const pullDown = usePull('down', handleListCollapsed);
  // Up over the screen, the list is a panel like any other: back puts it away
  // rather than leaving the timer. Only while it is actually up — a solve in
  // progress hides it, and a back press should not be spent on it then.
  useBackToClose(handleListCollapsed, showBrowsing);

  return (
    <main
      className={
        isEngaged
          ? 'screen screen--solving'
          : showBrowsing
            ? 'screen screen--browsing'
            : 'screen'
      }
    >
      {/* Under the list while it is up, so out of reach entirely rather than
          only out of sight: nothing covered should take a Tab or be read out. */}
      <div className="scramble-slot" inert={showBrowsing}>
        <ScramblePanel
          scramble={scramble.scramble}
          error={scramble.error}
          onRetry={scramble.next}
          hidden={isEngaged || resultVisible}
        />
        {resultVisible ? (
          <div className="result-bar">
            <button
              type="button"
              className="result-bar__next"
              onClick={() => {
                setShowResult(false);
                // Moving on to the next scramble takes the finished time off
                // the clock with it — it belongs to the solve now in the list.
                timer.reset();
              }}
            >
              {strings.timer.nextScramble}
            </button>
          </div>
        ) : null}
      </div>

      {/* One grid cell, so the phase bar stays with the number it belongs to
          instead of being pushed to the bottom by the stretching timer. */}
      <div className="timer-slot" inert={showBrowsing}>
        <TimerDisplay
          state={timer.state}
          displayMs={timer.displayMs}
          inspectionMs={timer.inspectionMs}
          armed={timer.armed}
          finishArmed={timer.finishArmed}
          byPhase={timer.phaseIndex !== null}
          resultShown={resultVisible}
          record={recordNote}
          inspectionCues={timer.inspectionCues}
          inspectionEnabled={timer.inspectionEnabled}
          touchHandlers={timer.touchHandlers}
        />

        {/* The phases of the solve being run, under the clock they add up to. */}
        {timer.state.status === 'running' && phases.length > 0 ? (
          <PhaseRun
            phases={phases}
            splitMs={timer.state.splitMs}
            elapsedMs={timer.displayMs ?? 0}
          />
        ) : null}

        {/* The phases of the solve just finished, under the time it produced. */}
        {shownSolve && shownSolve.splits.length > 0 ? (
          <PhaseBar
            splits={shownSolve.splits}
            phases={methodPhases}
            rawMs={shownSolve.rawMs}
            bestPhases={shownBestPhases}
          />
        ) : null}
      </div>

      {/* Nobody aims for the numbers with a cube in both hands: from the first
          touch, the whole screen is the button — it starts the inspection's
          hold, starts the solve, and stops it. */}
      {isEngaged || status === 'stopped' ? (
        <div className="timer-overlay" aria-hidden="true" {...timer.touchHandlers} />
      ) : null}

      {/* The slot keeps the list's place in the grid while the list itself is
          lifted out of it and slid over the screen. */}
      <div className="solves-slot" ref={sheetSlot}>
        <section
          ref={sheetPanel}
          className={
            isEngaged
              ? 'solves-panel solves-panel--hidden'
              : isSheet
                ? 'solves-panel is-sheet'
                : 'solves-panel'
          }
        >
          {/* A grip, only while the list is up. The list itself cannot carry the
              gesture: the browser claims a drag on a scrolling element after a
              dozen pixels, long before one could be told from a scroll. This is
              not scrollable, so the whole drag arrives — and it takes a tap as
              well, for the reader who does not think to pull it. */}
          {showBrowsing ? (
            <button
              type="button"
              className="solves-panel__grip"
              aria-label={strings.solve.collapseList}
              onClick={handleListCollapsed}
              {...pullDown}
            />
          ) : null}
          <h2 className="solves-panel__title">
            {/* The session name doubles as the way into session switching. */}
            <button
              type="button"
              className="solves-panel__session"
              title={strings.sessions.switchSession}
              onClick={() => setPickerOpen(true)}
            >
              {session?.name ?? strings.appName}
            </button>
            · {solves.length}
            {/* The list is a peek by default; this pulls it up over the cube. */}
            <button
              type="button"
              className="solves-panel__more"
              aria-expanded={showBrowsing}
              aria-label={showBrowsing ? strings.solve.collapseList : strings.solve.expandList}
              onClick={() => setBrowsing((open) => !open)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={showBrowsing ? 'M7 10l5 5 5-5' : 'M7 14l5-5 5 5'} />
              </svg>
            </button>
            {/* Both switches set up the next attempt, and with the list up over
                the cube there is no next attempt in sight — this is a screen for
                reading what has already been timed. They come back with it. */}
            {showBrowsing ? null : (
              <span className="solves-panel__toggles">
                <label className="toggle solves-panel__toggle">
                  <input
                    type="checkbox"
                    checked={timer.inspectionEnabled}
                    onChange={(event) => timer.setInspectionEnabled(event.target.checked)}
                    aria-label={strings.timer.inspectionToggleLabel}
                  />
                  {strings.timer.inspectionToggle}
                </label>
                <label className="toggle solves-panel__toggle">
                  <input
                    type="checkbox"
                    checked={splitMode === 'phases'}
                    disabled={methodPhases.length === 0}
                    onChange={(event) => setSplitMode(event.target.checked ? 'phases' : 'total')}
                    aria-label={strings.timer.phaseToggleLabel}
                  />
                  {strings.timer.phaseToggle}
                </label>
              </span>
            )}
          </h2>
          <MiniStats sessionId={session?.id ?? null} puzzle={PUZZLE} />
          <SolveList
            solves={solves}
            phases={methodPhases}
            bests={records.bests}
            globalPbMs={records.globalPbMs}
            pull={showBrowsing ? undefined : pullUp}
            onOpen={setOpenSolveId}
            onChangePenalty={handleChangePenalty}
            onDelete={handleDelete}
          />
        </section>
      </div>

      {openSolveId === null ? null : (
        <SolveDetailSheet
          solveId={openSolveId}
          phases={methodPhases}
          solveIds={openableSolves}
          onOpen={setOpenSolveId}
          onClose={() => setOpenSolveId(null)}
        />
      )}

      {/* Outside the panel that holds its button: the panel slides away
          while a solve is running, and the sheet is fixed to the screen. */}
      {isPickerOpen ? (
        <SessionPicker onClose={() => setPickerOpen(false)} />
      ) : null}
    </main>
  );
}
