import { useCallback, useMemo, useState } from 'react';
import type { MethodPhase, Penalty } from '../../../db/types';
import { bestPhasesIn } from '../../../domain/stats/phases';
import { resultNote, type Challenge, type ResultNote } from '../../../domain/stats/records';
import { finalMs } from '../../../domain/solve/final-time';
import { formatGoal, formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { reportError } from '../../../lib/errors';
import { InstallNudge } from '../../about';
import { SolveDetailSheet } from '../../history';
import { SessionPicker, useActiveSession } from '../../sessions';
import { PhaseBar, PhaseRun, usePhases, useVoiceShadow, VoiceShadowNote } from '../../splits';
import { MiniStats } from '../../stats';
import { useRecentSolves } from '../hooks/use-recent-solves';
import { useSaveSolve } from '../hooks/use-save-solve';
import { useSheetMotion } from '../hooks/use-sheet-motion';
import { useScramble } from '../../../hooks/use-scramble';
import {
  advancePin,
  pinScramble,
  unpinScramble,
  usePinnedScramble,
} from '../../../hooks/use-pinned-scramble';
import { useBackToClose } from '../../../hooks/use-back-to-close';
import { usePull } from '../../../hooks/use-pull';
import { useRecordsOf } from '../../../hooks/use-session-records';
import { useSessionSolves } from '../../../hooks/use-session-solves';
import { useSetting } from '../../../hooks/use-setting';
import { useTimer, type CompletedAttempt } from '../../../hooks/use-timer';
import { ScramblePanel } from './ScramblePanel';
import { ScrambleSheet } from './ScrambleSheet';
import { SolveList } from './SolveList';
import { TimerDisplay, type TimerNote } from '../../../components/TimerDisplay';

const PUZZLE = '333';
const MODE = 'freestyle';
const EMPTY_PHASES: never[] = [];

/**
 * A note put into words. The phase tier is the only one that needs the
 * method: `resultNote` deals in phase keys, and nobody wants to read one.
 */
function noteFor(note: ResultNote, phases: readonly MethodPhase[]): TimerNote {
  const star = strings.history.star;
  if (note.kind === 'pb') return { tier: 'pb', mark: star, label: strings.timer.recordPb };
  if (note.kind === 'session') {
    return { tier: 'session', mark: star, label: strings.timer.recordSession };
  }
  if (note.kind === 'challenge') {
    const target =
      note.count === 1
        ? formatMs(note.targetMs)
        : strings.timer.challengeAverage(note.count, formatMs(note.targetMs));
    const { outcome } = note;
    // Beaten, it is said the way a beaten goal is; not beaten, quieter still.
    if (outcome.kind === 'beaten') {
      return {
        tier: 'goal',
        mark: strings.timer.goalMark,
        label: strings.timer.challengeBeaten(target, formatMs(outcome.marginMs)),
      };
    }
    if (outcome.kind === 'tied') {
      return {
        tier: 'short',
        mark: strings.timer.challengeTiedMark,
        label: strings.timer.challengeTied(target),
      };
    }
    return {
      tier: 'short',
      mark: strings.timer.challengeMissedMark,
      label:
        outcome.marginMs === null
          ? strings.timer.challengeMissedDnf(target)
          : strings.timer.challengeMissed(target, formatMs(outcome.marginMs)),
    };
  }
  if (note.kind === 'goal') {
    // Named the way the stats screen names it, so the goal reads as one thing.
    return {
      tier: 'goal',
      mark: strings.timer.goalMark,
      label: strings.stats.goalName(formatGoal(note.goalMs)),
    };
  }
  const named = note.phases.map((key) => phases.find((phase) => phase.key === key)?.label ?? key);
  return {
    tier: 'phase',
    mark: star,
    label: strings.timer.recordPhases(named.join(strings.timer.recordPhaseJoin)),
  };
}

export function TimerScreen() {
  const session = useActiveSession(PUZZLE, MODE);
  const scramble = useScramble(PUZZLE);
  const pinned = usePinnedScramble();
  // What the next attempt is timed on: one put here by hand or taken from the
  // history, or else the generated one, which waits underneath until then.
  const current = pinned?.scramble ?? scramble.scramble;
  const [isEditingScramble, setEditingScramble] = useState(false);
  const openScramble = useCallback(() => setEditingScramble(true), []);
  const { solves, total, changePenalty, remove } = useRecentSolves(session?.id ?? null);
  const [splitMode, setSplitMode] = useSetting('timer.splitMode');
  const [runningDisplay] = useSetting('timer.runningDisplay');
  // Set on the stats screen; 0 there means no goal.
  const [goalSetting] = useSetting('stats.goalMs');
  const methodPhases = usePhases(session?.methodId ?? null);

  // Empty means the plain timer. The phases come from the session's method,
  // never from a list in the code (SPEC 3.6).
  const phases = splitMode === 'phases' ? methodPhases : EMPTY_PHASES;
  const phaseKeys = useMemo(() => phases.map((phase) => phase.key), [phases]);
  // After a solve the result stays under the clock until the next attempt
  // starts. The next scramble does not wait for it: it is what the hands go to
  // straight away.
  const [showResult, setShowResult] = useState(false);
  // The scramble the finished solve was timed on. It stays hidden until the
  // next one has replaced it, or it would read as the scramble to perform.
  const [solvedScramble, setSolvedScramble] = useState<string | null>(null);
  // The list, pulled up over the cube to be read. Any touch of the timer ends
  // it, so there is no way to be browsing and solving at once.
  const [isBrowsing, setBrowsing] = useState(false);

  const wasPinned = pinned !== null;
  const scrambleSource = pinned?.source ?? 'generated';
  // What the next solve is chasing, if it is one of a shared set with a time.
  // Memoised on the pin, or the callback below would change every frame.
  const challenge = useMemo((): Challenge | null => {
    if (pinned?.source !== 'shared') return null;
    const { targetMs, scrambles, resultsMs } = pinned.run;
    return targetMs === null ? null : { targetMs, count: scrambles.length, earlierMs: resultsMs };
  }, [pinned]);
  const pinnedLabel = useMemo(() => {
    if (pinned === null) return null;
    if (pinned.source !== 'shared') return strings.scramble.sources[pinned.source];
    const { run } = pinned;
    const count = run.scrambles.length;
    const named =
      count === 1
        ? strings.scramble.sources.shared
        : strings.scramble.sharedRun(count, run.resultsMs.length + 1);
    if (run.targetMs === null) return named;
    const target =
      count === 1
        ? formatMs(run.targetMs)
        : strings.timer.challengeAverage(count, formatMs(run.targetMs));
    return `${named} · ${strings.scramble.toBeat(target)}`;
  }, [pinned]);
  // What the finished solve was chasing. The scramble that carried it is gone
  // by the time the result is read — the next one of the set is up already.
  const [solvedChallenge, setSolvedChallenge] = useState<Challenge | null>(null);
  // A scramble chosen just now is one to show, even when it is the very one
  // just solved — which is what "solve it again" straight after a solve is.
  // Adjusted during render, or the panel would paint hidden first.
  const [pinnedSeen, setPinnedSeen] = useState(pinned);
  if (pinned !== pinnedSeen) {
    setPinnedSeen(pinned);
    if (pinned !== null) setSolvedScramble(null);
  }

  const saveSolve = useSaveSolve();
  const handleComplete = useCallback(
    (attempt: CompletedAttempt) => {
      setShowResult(true);
      setSolvedScramble(current);
      setSolvedChallenge(challenge);
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

      saveSolve(
        {
          sessionId: session.id,
          puzzle: PUZZLE,
          mode: MODE,
          // A missing scramble must not cost the user the time itself.
          scramble: current ?? '',
          scrambleSource,
          attempt,
          phaseKeys,
        },
        () => {
          // A chosen scramble is for one solve, or goes on to the next of a
          // shared set; the generated one waiting under it is still unseen,
          // so it comes back as it was.
          if (wasPinned) {
            advancePin(finalMs({ rawMs: Math.round(attempt.rawMs), penalty: attempt.penalty }));
          } else {
            scramble.next();
          }
        },
      );
    },
    [session, scramble, current, wasPinned, scrambleSource, challenge, phaseKeys, saveSolve],
  );

  const timer = useTimer(handleComplete, { phases: phaseKeys });
  const status = timer.state.status;
  // The voice trial listens only where there are taps to compare it with.
  const [isVoiceShadowOn] = useSetting('audio.voiceShadow');
  const isShadowing = isVoiceShadowOn && phaseKeys.length > 0;
  const voice = useVoiceShadow(timer.state, isShadowing);
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
  // Read once for both the records and the numbers under the list — see
  // useSessionSolves for why not twice.
  const sessionSolves = useSessionSolves(session?.id ?? null);
  const records = useRecordsOf(sessionSolves, PUZZLE, listedPhaseKeys);
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
  const goalMs = goalSetting > 0 ? goalSetting : null;
  const timerNote = useMemo(() => {
    if (shownSolve === null) return null;
    const note = resultNote(
      shownSolve,
      listedPhaseKeys,
      records.bests,
      records.globalPbMs,
      goalMs,
      solvedChallenge,
    );
    return note === null ? null : noteFor(note, methodPhases);
  }, [shownSolve, listedPhaseKeys, records, goalMs, solvedChallenge, methodPhases]);
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
          scramble={current}
          error={pinned === null ? scramble.error : null}
          onRetry={scramble.next}
          hidden={isEngaged || (resultVisible && current === solvedScramble)}
          pinnedLabel={pinnedLabel}
          onEdit={openScramble}
          onUnpin={unpinScramble}
        />
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
          note={timerNote}
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
            display={runningDisplay}
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

        {/* A microphone that would not open is said at rest too, not only
            after a solve that was timed without it. */}
        {isShadowing && !isEngaged && (resultVisible || voice.mic.kind === 'failed') ? (
          <VoiceShadowNote mic={voice.mic} result={voice.result} />
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
            · {total}
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
                  {/* Abbreviated only where the row is short of room; the
                      input carries the full name for a screen reader. */}
                  <span className="solves-panel__short" aria-hidden="true">
                    {strings.timer.inspectionToggle}
                  </span>
                  <span className="solves-panel__full" aria-hidden="true">
                    {strings.timer.inspectionToggleLabel}
                  </span>
                </label>
                <label className="toggle solves-panel__toggle">
                  <input
                    type="checkbox"
                    checked={splitMode === 'phases'}
                    disabled={methodPhases.length === 0}
                    onChange={(event) => setSplitMode(event.target.checked ? 'phases' : 'total')}
                    aria-label={strings.timer.phaseToggleLabel}
                  />
                  <span className="solves-panel__short" aria-hidden="true">
                    {strings.timer.phaseToggle}
                  </span>
                  <span className="solves-panel__full" aria-hidden="true">
                    {strings.timer.phaseToggleLabel}
                  </span>
                </label>
              </span>
            )}
          </h2>
          <InstallNudge />
          <MiniStats solves={sessionSolves} />
          <SolveList
            solves={solves}
            total={total}
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

      {isEditingScramble ? (
        <ScrambleSheet
          scramble={current}
          onUse={(text) => {
            pinScramble(text, 'own');
            setEditingScramble(false);
          }}
          onNewRandom={() => {
            if (pinned === null) scramble.next();
            else unpinScramble();
            setEditingScramble(false);
          }}
          onClose={() => setEditingScramble(false)}
        />
      ) : null}

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
