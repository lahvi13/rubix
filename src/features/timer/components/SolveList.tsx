import { memo, useEffect, useRef, useState } from 'react';
import type { MethodPhase, Penalty, Solve } from '../../../db/types';
import type { PullHandlers } from '../../../hooks/use-pull';
import { SolvePhases } from '../../splits';
import { finalMs } from '../../../domain/solve/final-time';
import { bestPhasesIn, type Bests } from '../../../domain/stats/phases';
import { togglePenalty } from '../../../domain/solve/penalty';
import { now } from '../../../lib/clock';
import { formatResult, formatWhen } from '../../../lib/format';
import { strings } from '../../../lib/strings';

interface SolveListProps {
  solves: Solve[];
  /**
   * The drag that pulls the list up over the cube, for as long as it is down.
   * Left out once it is up, when the list is a scroller again and a drag on
   * it means what it says.
   *
   * A drag rather than a scroll because of what a scroll costs: the browser
   * claims the gesture, and a claimed gesture grants no user activation, so
   * the back entry the panel wants to hold gets pushed without one and Chrome
   * skips straight past it. See `usePull`.
   */
  pull?: PullHandlers;
  /** A solve in the list is a way into it, the same as one in the history. */
  onOpen: (id: string) => void;
  /** The session's method, so a timed solve can show the shape of its phases. */
  phases: readonly MethodPhase[];
  /**
   * The session's records, read from the whole of it. This list is the latest
   * fifty, and the best of those is a fact about the list rather than about
   * the solve — which is not what a star should mean here or anywhere else.
   */
  bests: Bests;
  globalPbMs: number | null;
  onChangePenalty: (id: string, penalty: Penalty) => void;
  onDelete: (id: string) => void;
}

/**
 * How long the delete button stays armed. Long enough to move a thumb one
 * button along, short enough that it is never still armed when the reader
 * comes back to the row after the next solve.
 */
const DISARM_AFTER_MS = 4000;

/**
 * Flat list of the session's solves. Penalties and deletion are offered on the
 * most recent solve only — full editing lands with the history screen.
 * Memoised: the timer above repaints every animation frame, and fifty rows
 * must not be re-rendered sixty times a second on a phone.
 */
export const SolveList = memo(function SolveList({
  solves,
  phases,
  bests,
  globalPbMs,
  pull,
  onOpen,
  onChangePenalty,
  onDelete,
}: SolveListProps) {
  /*
   * Which solve's delete button is armed, by id rather than by a flag: these
   * buttons sit on whichever solve is newest, and the next one lands under
   * the reader's thumb a second or two later. Named by id, an arm cannot
   * outlive the row it was meant for.
   *
   * Two taps rather than one because of where the button is: +2 and DNF are
   * next to it, they are reached for with a cube still in hand, and a thumb
   * one button off would otherwise throw the solve away. The undo bar is
   * still behind this — it is the second net, not the first.
   */
  const [armedId, setArmedId] = useState<string | null>(null);
  useEffect(() => {
    if (armedId === null) return;
    const handle = setTimeout(() => setArmedId(null), DISARM_AFTER_MS);
    return () => clearTimeout(handle);
  }, [armedId]);

  /*
   * Back down to a peek, the list shows the newest solves again rather than
   * wherever it was left while it was up. It keeps its scroll position
   * otherwise, and down here it cannot be scrolled — so the peek would be
   * stuck showing the middle of the session with no way back to the top.
   *
   * `pull` is the collapsed state: it is handed in only while the list is
   * down, because that is the only time a drag on it is a gesture.
   */
  const list = useRef<HTMLOListElement>(null);
  const isDown = pull !== undefined;
  useEffect(() => {
    if (isDown && list.current !== null) list.current.scrollTop = 0;
  }, [isDown]);

  const phaseKeys = phases.map((phase) => phase.key);

  if (solves.length === 0) {
    return <p className="solves__empty">{strings.solve.empty}</p>;
  }

  // Read once for the whole list: every row is asking the same question.
  const at = now();

  return (
    <ol className="solves" ref={list} {...pull}>
      {solves.map((solve, index) => (
        <li key={solve.id} className={rowClass(solve, phaseKeys, bests)}>
          <button
            type="button"
            className="solves__open"
            onClick={() => {
              setArmedId(null);
              onOpen(solve.id);
            }}
          >
            <span className="solves__index">{solves.length - index}.</span>
            <SolveTime solve={solve} bests={bests} globalPbMs={globalPbMs} />
            <span className="solves__meta">
              {solve.penalty !== 'none' && solve.penaltySource === 'auto'
                ? strings.solve.autoPenalty
                : formatWhen(solve.createdAt, at)}
              {solve.starred === 1 ? (
                <span className="history__flag" role="img" aria-label={strings.history.marked}>
                  {strings.history.mark}
                </span>
              ) : null}
              {solve.note ? (
                <span className="history__flag" role="img" aria-label={strings.history.hasNote}>
                  {strings.history.noteMark}
                </span>
              ) : null}
            </span>
          </button>
          {index === 0 ? (
            <span className="solves__actions">
              <button
                type="button"
                className={solve.penalty === 'plus2' ? 'is-active' : ''}
                onClick={() => {
                  setArmedId(null);
                  onChangePenalty(solve.id, togglePenalty(solve.penalty, 'plus2'));
                }}
              >
                {strings.solve.plusTwo}
              </button>
              <button
                type="button"
                className={solve.penalty === 'dnf' ? 'is-active' : ''}
                onClick={() => {
                  setArmedId(null);
                  onChangePenalty(solve.id, togglePenalty(solve.penalty, 'dnf'));
                }}
              >
                {strings.solve.dnf}
              </button>
              <button
                type="button"
                className={armedId === solve.id ? 'is-danger' : ''}
                aria-label={armedId === solve.id ? strings.solve.confirmDeleteLabel : undefined}
                onClick={() => {
                  if (armedId !== solve.id) {
                    setArmedId(solve.id);
                    return;
                  }
                  setArmedId(null);
                  onDelete(solve.id);
                }}
              >
                {armedId === solve.id ? strings.solve.confirmDelete : strings.solve.delete}
              </button>
            </span>
          ) : null}
          {/* Which of them were timed by phase, without opening any. No
              numbers: this list is a peek under a running timer. */}
          {/* The same ring the history draws round a phase that is the fastest
              it has been. Here it matters more: this is the list a solve is
              looked at in while the cube is still in hand. */}
          <SolvePhases
            solve={solve}
            phases={phases}
            detail="shape"
            bestPhases={bestPhasesIn(solve, phaseKeys, bests)}
          />
        </li>
      ))}
    </ol>
  );
});

interface SolveTimeProps {
  solve: Solve;
  bests: Bests;
  globalPbMs: number | null;
}

/** The time, wearing whichever record it holds — the history's tiers exactly. */
function SolveTime({ solve, bests, globalPbMs }: SolveTimeProps) {
  const resultMs = finalMs(solve);
  const isBest = resultMs !== null && resultMs === bests.totalMs;
  const isPb = resultMs !== null && resultMs === globalPbMs;

  return (
    <span
      className={
        isPb ? 'solves__time is-best is-record' : isBest ? 'solves__time is-best' : 'solves__time'
      }
    >
      {formatResult(resultMs, solve.penalty)}
      {isPb || isBest ? (
        <span
          className={isPb ? 'history__best is-record' : 'history__best'}
          role="img"
          aria-label={isPb ? strings.history.personalBest : strings.history.sessionBest}
        >
          {strings.history.star}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Rows holding a record are lit, the way the history lights them: the whole
 * row rather than one number, so the ones worth opening can be picked out
 * without reading any of them.
 */
function rowClass(solve: Solve, phaseKeys: readonly string[], bests: Bests): string {
  const resultMs = finalMs(solve);
  const holdsBest =
    (resultMs !== null && resultMs === bests.totalMs) ||
    bestPhasesIn(solve, phaseKeys, bests).length > 0;
  return holdsBest ? 'solves__row is-notable' : 'solves__row';
}
