import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { AlgCase, Algorithm } from '../../../db/types';
import { listCasesWithAlgs, type CaseWithAlg } from '../../../db/repositories/alg-repository';
import { loadDrillPool } from '../../../db/repositories/drill-repository';
import { addRecognitionAttempt } from '../../../db/repositories/recognition-repository';
import { parseAlg, type Move } from '../../../domain/cube/notation';
import type { CubeState } from '../../../domain/cube/state';
import { aufForAngle } from '../../../domain/recognition/angle';
import { drillScramble } from '../../../domain/drill/scramble';
import { fromOtherCorner } from '../../../domain/recognition/corner';
import { buildRound, MIN_POOL } from '../../../domain/recognition/round';
import { now } from '../../../lib/clock';
import { reportError } from '../../../lib/errors';
import { systemRandom } from '../../../lib/random';
import { strings } from '../../../lib/strings';
import { stateOf } from './use-alg-cases';

const PUZZLE = '333';

/** One card on offer: the case as the trainer draws it, in its own chart. */
export interface RecognitionOption {
  algCase: AlgCase;
  state: CubeState;
}

export interface RecognitionQuestion {
  answer: AlgCase;
  /** How the case is solved, once it is no longer a secret. */
  algorithm: Move[];
  /**
   * The turn to make before it, for the angle this question was met at. Empty
   * when none is needed; null when the algorithm does not solve the case at
   * all, which is what somebody's half-typed variant looks like.
   */
  auf: Move[] | null;
  /** The cube as it is met — the setup, turned and AUF'd at random. */
  state: CubeState;
  /** The same cube from the back-left corner, for when two sides do not say. */
  turnedState: CubeState;
  /** What produced the picture, kept with the attempt. */
  scramble: string;
  options: RecognitionOption[];
}

export interface RecognitionOutcome {
  chosenId: string;
  isCorrect: boolean;
  elapsedMs: number;
}

/** Why there is no question to answer. */
export type RecognitionProblem = 'loading' | 'empty' | 'tooFew';

export interface RecognitionView {
  /** Every case of the set, for the picker. Undefined while loading. */
  cases: CaseWithAlg[] | undefined;
  question: RecognitionQuestion | null;
  problem: RecognitionProblem | null;
  /** The cube has been turned round to show the other two sides. */
  isTurned: boolean;
  turn: () => void;
  /** Null until this question has been answered. */
  outcome: RecognitionOutcome | null;
  answer: (caseId: string) => void;
  next: () => void;
}

/** What a round needs to survive a re-render: the draw, not the pictures. */
interface Round {
  answerId: string;
  optionIds: string[];
  scramble: string;
  state: CubeState;
}

/**
 * Recognition: which case is this, answered by picking it out of a handful of
 * cards, with only the two sides you would see mid-solve on show.
 *
 * The clock is not the solve timer. There is nothing to perform, so there is
 * nothing to hold and release: the question appears, the clock starts, and the
 * card that gets tapped stops it. It is measured with performance.now() and
 * started in an effect, which is to say after the picture has been painted —
 * timing from the render would charge the reader for the browser's work.
 *
 * Drawing the case from the same pool as the drill is deliberate: ticking the
 * ten cases you keep losing to should not have to be done twice.
 */
export function useRecognition(setId: string, selectedIds: readonly string[]): RecognitionView {
  const selectionKey = selectedIds.join(',');

  const data = useLiveQuery(async () => {
    const ids = selectionKey === '' ? [] : selectionKey.split(',');
    const [cases, pool] = await Promise.all([listCasesWithAlgs(setId), loadDrillPool(setId, ids)]);
    return { cases, pool };
  }, [setId, selectionKey]);

  const cases = data?.cases;
  const pool = useMemo(() => data?.pool, [data]);

  const [round, setRound] = useState<Round | null>(null);
  const [isTurned, setTurned] = useState(false);
  const [outcome, setOutcome] = useState<RecognitionOutcome | null>(null);

  // Which pool the question was drawn from. A different set, or a different
  // tick in the picker, and it has to be drawn again — adjusted during render
  // rather than in an effect, or the previous set's case is painted first.
  const poolKey = pool === undefined ? null : pool.map((entry) => entry.algCase.id).join(',');
  const [drawnFor, setDrawnFor] = useState<string | null>(null);
  if (poolKey !== null && poolKey !== drawnFor) {
    setDrawnFor(poolKey);
    setRound(drawRound(pool ?? [], null));
    setTurned(false);
    setOutcome(null);
  }

  const question = useMemo<RecognitionQuestion | null>(() => {
    if (round === null || pool === undefined) return null;

    const byId = new Map(pool.map((entry) => [entry.algCase.id, entry]));
    const answer = byId.get(round.answerId);
    if (answer === undefined) return null;

    const options: RecognitionOption[] = [];
    for (const id of round.optionIds) {
      const entry = byId.get(id);
      // A case that has gone since the round was drawn is simply not offered.
      if (entry !== undefined) {
        options.push({ algCase: entry.algCase, state: stateOf(entry.algCase.setupAlg) });
      }
    }

    const algorithm = movesOf(answer.active);
    return {
      answer: answer.algCase,
      algorithm,
      // Worked out for this angle rather than for the case: the same algorithm
      // wants a different turn in front of it depending on where the case was
      // met, and that turn is half of what a solver does after recognising it.
      auf: aufForAngle(round.state, algorithm),
      state: round.state,
      turnedState: fromOtherCorner(round.state),
      scramble: round.scramble,
      options,
    };
  }, [pool, round]);

  /**
   * When the question went up. Set after paint, and only while it is still
   * unanswered — the re-render that follows storing an attempt must not
   * restart the clock behind it.
   */
  const startedAtRef = useRef(0);
  const isWaiting = question !== null && outcome === null;
  useEffect(() => {
    if (isWaiting) startedAtRef.current = performance.now();
  }, [isWaiting, round]);

  const next = useCallback(() => {
    setTurned(false);
    setOutcome(null);
    setRound((previous) => drawRound(pool ?? [], previous?.answerId ?? null));
  }, [pool]);

  const answer = useCallback(
    (caseId: string) => {
      // A second tap lands on a card that is already showing the answer, not
      // on a new attempt.
      if (round === null || outcome !== null) return;

      const elapsedMs = Math.max(0, Math.round(performance.now() - startedAtRef.current));
      const isCorrect = caseId === round.answerId;
      setOutcome({ chosenId: caseId, isCorrect, elapsedMs });

      void addRecognitionAttempt({
        puzzle: PUZZLE,
        caseId: round.answerId,
        scramble: round.scramble,
        rawMs: elapsedMs,
        isCorrect,
        startedAt: now() - elapsedMs,
      }).catch((cause: unknown) => {
        reportError(strings.errors.saveSolve, cause);
      });
    },
    [outcome, round],
  );

  return {
    cases,
    question,
    problem: problemOf(pool),
    isTurned,
    turn: () => setTurned((turned) => !turned),
    outcome,
    answer,
    next,
  };
}

function problemOf(pool: CaseWithAlg[] | undefined): RecognitionProblem | null {
  if (pool === undefined) return 'loading';
  if (pool.length === 0) return 'empty';
  if (pool.length < MIN_POOL) return 'tooFew';
  return null;
}

/** The algorithm a case is drilled with, or nothing to show. */
function movesOf(algorithm: Algorithm | null): Move[] {
  if (algorithm === null) return [];
  const parsed = parseAlg(algorithm.moves);
  // Text that does not parse is a variant somebody typed and the app kept as
  // written; there is nothing to print as moves.
  return parsed.ok ? parsed.moves : [];
}

/** One round: which case, which cards, and the cube the reader is shown. */
function drawRound(pool: readonly CaseWithAlg[], previousId: string | null): Round | null {
  const round = buildRound(
    pool.map((entry) => ({ id: entry.algCase.id, group: entry.algCase.group })),
    previousId,
    systemRandom,
  );
  if (round === null) return null;

  const answer = pool.find((entry) => entry.algCase.id === round.answerId)?.algCase;
  if (answer === undefined) return null;

  // A setup that does not parse belongs to a case somebody typed in: the case
  // is still worth recognising, just not from an angle we cannot construct.
  const built = drillScramble(answer.setupAlg, systemRandom);
  return {
    answerId: round.answerId,
    optionIds: round.optionIds,
    scramble: built?.text ?? answer.setupAlg,
    state: built?.state ?? stateOf(answer.setupAlg),
  };
}
