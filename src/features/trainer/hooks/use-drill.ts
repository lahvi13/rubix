import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { AlgCase, Algorithm, Penalty } from '../../../db/types';
import { listCasesWithAlgs, type CaseWithAlg } from '../../../db/repositories/alg-repository';
import { addDrillSolve, loadDrillPool } from '../../../db/repositories/drill-repository';
import { deleteSolve, setPenalty } from '../../../db/repositories/solve-repository';
import { togglePenalty } from '../../../domain/solve/penalty';
import { CROSS_SET_ID } from '../../../db/seed/packs';
import { crossScramble } from '../../../domain/drill/cross-scramble';
import { drillScramble } from '../../../domain/drill/scramble';
import { pickNextCase } from '../../../domain/drill/selection';
import { useTimer, type CompletedAttempt, type TimerView } from '../../../hooks/use-timer';
import { now } from '../../../lib/clock';
import { reportError, watchWrite } from '../../../lib/errors';
import { systemRandom } from '../../../lib/random';
import { strings } from '../../../lib/strings';

const PUZZLE = '333';

/** The case on screen and the scramble that gets you to it. */
export interface DrillItem {
  algCase: AlgCase;
  algorithm: Algorithm | null;
  scramble: string;
}

/** A stored drill attempt, kept only while its answer is on screen. */
export interface StoredAttempt {
  id: string;
  penalty: Penalty;
}

/** An answer on show, and the case it is the answer to. */
interface Revealed {
  caseId: string;
  /** The user asked to see it before solving, so the attempt cannot count. */
  gaveUp: boolean;
}

export interface DrillView {
  /** Every case of the set, for the picker. Undefined while loading. */
  cases: CaseWithAlg[] | undefined;
  /** The cases actually being drilled — the selection, or the whole set. */
  pool: CaseWithAlg[] | undefined;
  current: DrillItem | null;
  /** Cross is drilled from a scramble, so it has no case to recognise. */
  isCross: boolean;
  timer: TimerView;
  /** The case, its algorithm and its statistics are on show. */
  isRevealed: boolean;
  /** The user asked to see it before solving, so the attempt does not count. */
  gaveUp: boolean;
  /** Give up on the case being drilled. */
  reveal: () => void;
  /**
   * The attempt just stored, while it is still on screen. Null before there
   * is one, and after it has been thrown away.
   */
  stored: StoredAttempt | null;
  /** +2 or DNF on that attempt; pressing the one already set clears it. */
  judge: (penalty: Exclude<Penalty, 'none'>) => void;
  /** That was not a solve: take it out of the case's numbers for good. */
  discard: () => void;
  /** Put the screen back to a fresh attempt: no answer, blank clock. */
  reset: () => void;
  /** Move on to the next case. */
  next: () => void;
}

/**
 * The drill: one case at a time out of the chosen pool, timed the same way a
 * solve is, with the answer kept back until the attempt is over.
 *
 * Inspection is off (see useTimer): the seconds spent working out which case
 * this is are the point of the exercise, not something to be penalised at 15.
 */
export function useDrill(setId: string, selectedIds: readonly string[]): DrillView {
  const isCross = setId === CROSS_SET_ID;
  const selectionKey = selectedIds.join(',');

  const data = useLiveQuery(
    async () => {
      const ids = selectionKey === '' ? [] : selectionKey.split(',');
      const [cases, pool] = await Promise.all([
        listCasesWithAlgs(setId),
        loadDrillPool(setId, ids),
      ]);
      return { cases, pool };
    },
    [setId, selectionKey],
  );
  const cases = data?.cases;
  const pool = data?.pool;

  /*
   * The cross gets its own scramble, drawn here rather than fetched from
   * cubing.js. A random-state scramble solves a problem the cross does not
   * have — it takes a solved cube to a random state, and this drill starts
   * from a solved cross — so the whole library, worker and all, was being
   * loaded to produce twenty turns where sixteen do (see cross-scramble.ts).
   */
  const [crossWalk, setCrossWalk] = useState(() => crossScramble(systemRandom));

  const [pick, setPick] = useState<DrillItem | null>(null);
  /**
   * The answer on show, and which case it belongs to. Keyed by case rather
   * than a plain flag, so an answer can never outlive the case it answers:
   * moving on — Next case, another set, a different pool — makes it stop
   * matching, and there is no state left over to forget to clear.
   */
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [stored, setStored] = useState<StoredAttempt | null>(null);

  const current: DrillItem | null = useMemo(() => {
    if (!isCross) return pick;
    const crossCase = pool?.[0];
    if (crossCase === undefined) return null;
    return {
      algCase: crossCase.algCase,
      algorithm: null,
      scramble: crossWalk.text,
    };
  }, [crossWalk, isCross, pick, pool]);

  const advance = useCallback(
    (previousId: string | null) => {
      setPick(drawFrom(pool ?? [], previousId));
    },
    [pool],
  );

  // Which pool the case on screen was drawn from. A different set, or a
  // different tick in the picker, and the case has to be drawn again.
  const poolKey = pool === undefined ? null : pool.map((entry) => entry.algCase.id).join(',');
  const [drawnFor, setDrawnFor] = useState<string | null>(null);
  if (!isCross && poolKey !== null && poolKey !== drawnFor) {
    // Adjusted during render rather than in an effect: this is React's own
    // "the state no longer matches what it was derived from" case, and doing
    // it in an effect would paint the previous set's case first.
    setDrawnFor(poolKey);
    setPick(drawFrom(pool ?? [], null));
  }

  // The completion callback lives as long as the timer does, so what it needs
  // is read from refs rather than captured.
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  });

  const handleComplete = useCallback((attempt: CompletedAttempt) => {
    const item = currentRef.current;
    if (item === null) return;
    // Looking the case up locks the clock, so nothing can arrive here on a
    // case whose answer was already on screen.
    setRevealed({ caseId: item.algCase.id, gaveUp: false });

    void addDrillSolve({
      puzzle: PUZZLE,
      caseId: item.algCase.id,
      scramble: item.scramble,
      rawMs: attempt.rawMs,
      penalty: attempt.penalty,
      penaltySource: 'auto',
      inspectionMs: attempt.inspectionMs,
      startedAt: now() - Math.round(attempt.rawMs),
    })
      .then((solve) => setStored({ id: solve.id, penalty: solve.penalty }))
      .catch((cause: unknown) => {
        reportError(strings.errors.saveSolve, cause);
      });
  }, []);

  /*
   * An answer is on show for the case on screen — whether it was earned or
   * looked up. From here the clock is locked: knowing the case is most of the
   * work, so a second time on it is not a time, and storing it would flatter
   * the case's numbers with an attempt nobody really made. Next case is the
   * way on, and it clears this by clearing the answer.
   */
  const hasAnswer = revealed !== null && revealed.caseId === current?.algCase.id;

  // Inspection is off for algorithm cases — fifteen seconds of it over a
  // three-second PLL trains nothing, and the automatic +2 would fire on every
  // attempt where somebody thought about the case. The cross is the opposite:
  // reading the scramble and planning the cross inside inspection is exactly
  // the thing being practised, so there it follows the timer's own switch.
  const timer = useTimer(handleComplete, {
    inspection: isCross ? 'setting' : 'off',
    locked: hasAnswer,
  });
  const status = timer.state.status;

  // Derived rather than synchronised, like the timer screen's result: the
  // answer stays up only while the clock is at rest and still belongs to the
  // case on screen. Starting the next attempt hides it with no bookkeeping.
  const isAtRest = status === 'stopped' || status === 'idle';
  const shownAnswer = revealed?.caseId === current?.algCase.id ? revealed : null;
  const isRevealed = shownAnswer !== null && isAtRest;

  /**
   * Back to a fresh attempt: no answer, and a clock that is not still showing
   * a time somebody got on a different case.
   */
  const resetTimer = timer.reset;
  const reset = useCallback(() => {
    setRevealed(null);
    setStored(null);
    resetTimer();
  }, [resetTimer]);

  const next = useCallback(() => {
    reset();
    if (isCross) {
      setCrossWalk(crossScramble(systemRandom));
      return;
    }
    advance(currentRef.current?.algCase.id ?? null);
  }, [advance, isCross, reset]);

  return {
    cases,
    pool,
    current,
    isCross,
    timer,
    isRevealed,
    gaveUp: shownAnswer?.gaveUp ?? false,
    stored,
    judge: (penalty) => {
      if (stored === null) return;
      const next = togglePenalty(stored.penalty, penalty);
      setStored({ ...stored, penalty: next });
      watchWrite(() => setPenalty(stored.id, next), strings.drill.judging);
    },
    discard: () => {
      if (stored === null) return;
      setStored(null);
      watchWrite(() => deleteSolve(stored.id), strings.drill.discarding);
    },
    reveal: () => {
      if (current === null) return;
      setRevealed({ caseId: current.algCase.id, gaveUp: true });
      /*
       * Stored as a DNF, with no time because none was taken. A case you keep
       * looking up is the case most worth drilling, and leaving no trace hid
       * it from the very thing that finds those — a case with no attempts has
       * no pace, so it never reaches "Needs work" or the slowest ten. It also
       * puts a price on the button: reaching for the answer is a DNF, the way
       * giving up on a solve is.
       */
      watchWrite(
        () =>
          addDrillSolve({
            puzzle: PUZZLE,
            caseId: current.algCase.id,
            scramble: current.scramble,
            rawMs: 0,
            penalty: 'dnf',
            penaltySource: 'auto',
            inspectionMs: null,
            startedAt: now(),
          }).then((solve) => setStored({ id: solve.id, penalty: solve.penalty })),
        strings.errors.saveSolve,
      );
    },
    reset,
    next,
  };
}

/** One case out of the pool, with the scramble that presents it. */
function drawFrom(pool: readonly CaseWithAlg[], previousId: string | null): DrillItem | null {
  const chosen = pickNextCase(
    pool.map((entry) => ({ id: entry.algCase.id, entry })),
    previousId,
    systemRandom,
  );
  if (chosen === null) return null;

  const built = drillScramble(chosen.entry.algCase.setupAlg, systemRandom);
  return {
    algCase: chosen.entry.algCase,
    algorithm: chosen.entry.active,
    // A setup that does not parse belongs to a case the user typed in; there
    // is nothing to perform, and the screen says so rather than timing them
    // against a solved cube.
    scramble: built?.text ?? '',
  };
}
