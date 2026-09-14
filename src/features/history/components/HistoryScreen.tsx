import { Fragment, useMemo, useState } from 'react';
import type { MethodPhase, Penalty, Solve } from '../../../db/types';
import { finalMs } from '../../../domain/solve/final-time';
import { bestPhasesIn, type Bests } from '../../../domain/stats/phases';
import { useBackToClose } from '../../../hooks/use-back-to-close';
import { useMoveSolves } from '../../../hooks/use-move-solves';
import { now } from '../../../lib/clock';
import { dayKey, formatClock, formatDay, formatResult } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { SessionPicker, useActiveSession } from '../../sessions';
import { SolvePhases, usePhases } from '../../splits';
import { useHistory } from '../hooks/use-history';
import { useSolveDays } from '../hooks/use-solve-days';
import { useTags } from '../hooks/use-tags';
import { DayPicker } from './DayPicker';
import { SolveDetailSheet } from './SolveDetailSheet';
import { TagPanel } from './TagPanel';

const PUZZLE = '333';
const MODE = 'freestyle';
const PENALTY_FILTERS: Penalty[] = ['plus2', 'dnf'];

export function HistoryScreen() {
  const session = useActiveSession(PUZZLE, MODE);
  const phases = usePhases(session?.methodId ?? null);
  const phaseKeys = useMemo(() => phases.map((phase) => phase.key), [phases]);
  const history = useHistory(session?.id ?? null, PUZZLE, phaseKeys);
  const tags = useTags();
  const days = useSolveDays(session?.id ?? null);
  const at = now();
  const [openId, setOpenId] = useState<string | null>(null);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isMoveOpen, setMoveOpen] = useState(false);
  const [isTagPanelOpen, setTagPanelOpen] = useState(false);
  const [isDayPickerOpen, setDayPickerOpen] = useState(false);
  const moveSolves = useMoveSolves();
  // Picking solves is a mode, not a column of checkboxes on every row: it is
  // done now and then, and the room the boxes took was the row's.
  const [isSelecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const open = history.solves.find((solve) => solve.id === openId) ?? null;
  // What the sheet steps through: the filtered list as far as it is loaded.
  const openable = useMemo(() => history.solves.map((solve) => solve.id), [history.solves]);

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  // Picking covers the screen's usual meaning of a tap, so it reads as a place
  // of its own: back gets out of it, the way it gets out of a sheet, rather
  // than out of the history with the picks thrown away.
  useBackToClose(stopSelecting, isSelecting);

  const deleteSelected = () => {
    void history.removeMany([...selected]);
    stopSelecting();
  };

  const moveSelected = (sessionId: string, name: string) => {
    void moveSolves([...selected], sessionId, name);
    stopSelecting();
  };

  return (
    <main className="screen screen--scroll">
      <div className="filters">
        {PENALTY_FILTERS.map((penalty) => (
          <button
            key={penalty}
            type="button"
            // Same visible text as the penalty buttons in the drawer, so the
            // accessible name has to say which one this is.
            aria-label={`${strings.history.filterBy} ${penalty === 'plus2' ? strings.solve.plusTwo : strings.solve.dnf}`}
            className={history.filters.penalty === penalty ? 'is-active' : ''}
            onClick={() =>
              history.setFilters({
                ...history.filters,
                penalty: history.filters.penalty === penalty ? undefined : penalty,
              })
            }
          >
            {penalty === 'plus2' ? strings.solve.plusTwo : strings.solve.dnf}
          </button>
        ))}
        <button
          type="button"
          aria-label={strings.history.filterRecords}
          className={history.filters.record ? 'is-active' : ''}
          onClick={() =>
            history.setFilters({
              ...history.filters,
              record: history.filters.record ? undefined : true,
            })
          }
        >
          {strings.history.star}
        </button>
        <button
          type="button"
          aria-label={strings.history.filterMarked}
          className={history.filters.starred ? 'is-active' : ''}
          onClick={() =>
            history.setFilters({
              ...history.filters,
              starred: history.filters.starred ? undefined : true,
            })
          }
        >
          {strings.history.mark}
        </button>
        {/* Only offered once there is more than one day to choose between. */}
        {days.length > 1 ? (
          <button
            type="button"
            aria-label={strings.history.filterDay}
            className={history.filters.day === undefined ? '' : 'is-active'}
            onClick={() => setDayPickerOpen(true)}
          >
            {history.filters.day === undefined
              ? strings.history.days
              : formatDay(days.find((day) => day.key === history.filters.day)?.at ?? 0, at)}
          </button>
        ) : null}
        {tags.tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={history.filters.tagId === tag.id ? 'is-active' : ''}
            onClick={() =>
              history.setFilters({
                ...history.filters,
                tagId: history.filters.tagId === tag.id ? undefined : tag.id,
              })
            }
          >
            {tag.name}
          </button>
        ))}
        {/* Last in the row and about the tags beside it, not a filter of
            its own — this is the only screen where a tag is written, so
            it is the only one where a wrong one is noticed. */}
        <button
          type="button"
          className="filters__edit"
          onClick={() => setTagPanelOpen(true)}
        >
          {strings.history.editTags}
        </button>
      </div>

      <p className="history__summary">
        {/* The session name is the way into switching, the same as on the
            timer. Named rather than left to stand alone: a word on its own
            says neither that it is a session nor that it can be pressed. */}
        <span className="summary__session">
          {strings.sessions.label}
          <button
            type="button"
            className="session-switch"
            title={strings.sessions.switchSession}
            onClick={() => setPickerOpen(true)}
          >
            {session?.name ?? ''}
          </button>
        </span>
        {/* The whole session, unless a filter is narrowing it — then how much
            of it is left. The number loaded so far is not a count anyone
            asked for: "Load more" at the bottom already says there is more. */}
        ·{' '}
        {history.isFiltered
          ? strings.history.matchedOf(history.matchedCount, history.total)
          : strings.sessions.solveCount(history.total)}
        {history.solves.length > 0 ? (
          <button
            type="button"
            className={isSelecting ? 'history__select is-active' : 'history__select'}
            onClick={() => (isSelecting ? stopSelecting() : setSelecting(true))}
          >
            {isSelecting ? strings.history.stopSelecting : strings.history.startSelecting}
          </button>
        ) : null}
      </p>

      {/* Its own row rather than the summary's: two actions beside the
          session name and the counts leave nothing readable at a phone's
          width, and the row is only there while solves are being picked. */}
      {isSelecting ? (
        <div className="history__selection">
          <span>{strings.history.selected(selected.size)}</span>
          <button type="button" disabled={selected.size === 0} onClick={() => setMoveOpen(true)}>
            {strings.history.moveTo}
          </button>
          <button
            type="button"
            className="is-danger"
            disabled={selected.size === 0}
            onClick={deleteSelected}
          >
            {strings.history.deleteSelected}
          </button>
        </div>
      ) : null}

      {history.solves.length === 0 && history.isLoading ? null : history.solves.length === 0 ? (
        <p className="solves__empty">
          {history.isFiltered ? strings.history.empty : strings.history.noSolves}
        </p>
      ) : (
        <ol className={isSelecting ? 'history is-selecting' : 'history'}>
          {history.solves.map((solve, index) => {
            // A heading whenever the day changes. The list runs newest first,
            // so each one opens the day below it — which is what stops a long
            // session from being an undated column of numbers.
            const before = history.solves[index - 1];
            const startsDay =
              before === undefined || dayKey(before.createdAt) !== dayKey(solve.createdAt);

            return (
              <Fragment key={solve.id}>
                {startsDay ? (
                  <li className="history__day">{formatDay(solve.createdAt, at)}</li>
                ) : null}
                <HistoryRow
                  solve={solve}
                  phases={phases}
                  phaseKeys={phaseKeys}
                  bests={history.bests}
                  globalPbMs={history.globalPbMs}
                  tagColors={solve.tagIds.map((id) => tags.byId.get(id)?.color ?? '#555')}
                  isSelecting={isSelecting}
                  isSelected={selected.has(solve.id)}
                  onToggleSelected={() => toggleSelected(solve.id)}
                  onOpen={() => setOpenId(solve.id)}
                />
              </Fragment>
            );
          })}
        </ol>
      )}

      {history.hasMore ? (
        <button type="button" className="load-more" onClick={history.loadMore}>
          {strings.history.loadMore}
        </button>
      ) : null}

      {open ? (
        <SolveDetailSheet
          solveId={open.id}
          phases={phases}
          solveIds={openable}
          onOpen={setOpenId}
          onClose={() => setOpenId(null)}
        />
      ) : null}

      {isPickerOpen ? (
        <SessionPicker onClose={() => setPickerOpen(false)} />
      ) : null}

      {isMoveOpen ? (
        <SessionPicker
          title={strings.history.moveTitle}
          onPick={moveSelected}
          onClose={() => setMoveOpen(false)}
        />
      ) : null}

      {isDayPickerOpen ? (
        <DayPicker
          days={days}
          selected={history.filters.day}
          onPick={(day) => history.setFilters({ ...history.filters, day })}
          onClose={() => setDayPickerOpen(false)}
        />
      ) : null}

      {isTagPanelOpen ? (
        <TagPanel onClose={() => setTagPanelOpen(false)} />
      ) : null}
    </main>
  );
}

interface HistoryRowProps {
  solve: Solve;
  phases: readonly MethodPhase[];
  phaseKeys: readonly string[];
  bests: Bests;
  globalPbMs: number | null;
  tagColors: string[];
  isSelecting: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
}

function HistoryRow({
  solve,
  phases,
  phaseKeys,
  bests,
  globalPbMs,
  tagColors,
  isSelecting,
  isSelected,
  onToggleSelected,
  onOpen,
}: HistoryRowProps) {
  const resultMs = finalMs(solve);
  // A DNF has no result, so it cannot be the best one however small its rawMs.
  const isBest = resultMs !== null && resultMs === bests.totalMs;
  // The best this puzzle has ever seen, which may have been set in another
  // session; it wears its own colour so the two are never read as one thing.
  const isPb = resultMs !== null && resultMs === globalPbMs;
  const bestPhases = bestPhasesIn(solve, phaseKeys, bests);
  // Worth coming back to: it holds the session's best result, or the fastest
  // one of its phases has been. The whole row is lit rather than only the
  // number, so the ones to look at can be found without reading any of them.
  const holdsBest = isBest || bestPhases.length > 0;

  return (
    <li className={holdsBest ? 'history__row is-notable' : 'history__row'}>
      {isSelecting ? (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelected}
          aria-label={strings.history.select}
        />
      ) : null}
      {/* One line, laid on the list's own columns: the bar starts and ends at
          the same place in every row, so a phase that went well or badly can
          be found by running an eye down the column rather than by reading. */}
      <button
        type="button"
        className="history__open"
        aria-pressed={isSelecting ? isSelected : undefined}
        onClick={isSelecting ? onToggleSelected : onOpen}
      >
        {/* A stack at the row's edge rather than a run beside the clock: a
            solve with three tags would otherwise widen the clock's column for
            every row in the list. */}
        <span className="history__tags">
          {tagColors.map((color, index) => (
            <span key={index} className="history__dot" style={{ background: color }} />
          ))}
        </span>
        {/* One row, one colour: the time and its star say the same thing, or
            the reader has to work out which of them outranks the other. */}
        <span
          className={
            isPb ? 'history__time is-best is-record' : isBest ? 'history__time is-best' : 'history__time'
          }
        >
          {formatResult(resultMs, solve.penalty)}
          {/* One star, in the colour of the strongest thing it is. A phase
              best is not starred here: its own block is ringed on the bar
              beside it, which says which phase rather than only that one of
              them was. */}
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
        {/* Which phase the solve went in, and how much of it each one took —
            the question the history is read with. */}
        <SolvePhases solve={solve} phases={phases} detail="shares" bestPhases={bestPhases} />
        <span className="history__meta">
          {/* The clock alone: the heading above already says which day. */}
          {formatClock(solve.createdAt)}
          {/* Both wear the text's full strength rather than the meta's grey:
              they say the solve has something on it, and at the muted weight
              beside a timestamp they were being missed. Not a colour of their
              own — the accent and the gold on this row already mean a record
              apiece, and a third meaning in a third hue is how it stops being
              readable. */}
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
    </li>
  );
}
