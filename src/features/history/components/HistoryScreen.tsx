import { useMemo, useState } from 'react';
import type { MethodPhase, Penalty, Solve } from '../../../db/types';
import { finalMs } from '../../../domain/solve/final-time';
import { bestPhasesIn, type Bests } from '../../../domain/stats/phases';
import { useMoveSolves } from '../../../hooks/use-move-solves';
import { now } from '../../../lib/clock';
import { formatTime, formatWhen } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { SessionPicker, useActiveSession } from '../../sessions';
import { SolvePhases, usePhases } from '../../splits';
import { useHistory } from '../hooks/use-history';
import { useTags } from '../hooks/use-tags';
import { SolveDetailSheet } from './SolveDetailSheet';

const PUZZLE = '333';
const MODE = 'freestyle';
const PENALTY_FILTERS: Penalty[] = ['plus2', 'dnf'];

export function HistoryScreen() {
  const session = useActiveSession(PUZZLE, MODE);
  const phases = usePhases(session?.methodId ?? null);
  const phaseKeys = useMemo(() => phases.map((phase) => phase.key), [phases]);
  const history = useHistory(session?.id ?? null, phaseKeys);
  const tags = useTags();
  const [openId, setOpenId] = useState<string | null>(null);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isMoveOpen, setMoveOpen] = useState(false);
  const moveSolves = useMoveSolves();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const open = history.solves.find((solve) => solve.id === openId) ?? null;

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = () => {
    void history.removeMany([...selected]);
    setSelected(new Set());
  };

  const moveSelected = (sessionId: string, name: string) => {
    void moveSolves([...selected], sessionId, name);
    setSelected(new Set());
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
          aria-label={strings.history.filterStarred}
          className={history.filters.starred ? 'is-active' : ''}
          onClick={() =>
            history.setFilters({
              ...history.filters,
              starred: history.filters.starred ? undefined : true,
            })
          }
        >
          {strings.history.star}
        </button>
        {tags.tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={history.filters.tagId === tag.id ? 'is-active' : ''}
            style={{ borderColor: tag.color }}
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
        · {history.solves.length} / {history.total}
      </p>

      {/* Its own row rather than the summary's: two actions beside the
          session name and the counts leave nothing readable at a phone's
          width, and the row is only there while something is selected. */}
      {selected.size > 0 ? (
        <div className="history__selection">
          <span>{strings.history.selected(selected.size)}</span>
          <button type="button" onClick={() => setMoveOpen(true)}>
            {strings.history.moveTo}
          </button>
          <button type="button" className="is-danger" onClick={deleteSelected}>
            {strings.history.deleteSelected}
          </button>
        </div>
      ) : null}

      {history.solves.length === 0 ? (
        <p className="solves__empty">{strings.history.empty}</p>
      ) : (
        <ol className="history">
          {history.solves.map((solve) => (
            <HistoryRow
              key={solve.id}
              solve={solve}
              phases={phases}
              phaseKeys={phaseKeys}
              bests={history.bests}
              tagColors={solve.tagIds.map((id) => tags.byId.get(id)?.color ?? '#555')}
              isSelected={selected.has(solve.id)}
              onToggleSelected={() => toggleSelected(solve.id)}
              onOpen={() => setOpenId(solve.id)}
            />
          ))}
        </ol>
      )}

      {history.hasMore ? (
        <button type="button" className="load-more" onClick={history.loadMore}>
          {strings.history.loadMore}
        </button>
      ) : null}

      {open ? (
        <SolveDetailSheet solveId={open.id} phases={phases} onClose={() => setOpenId(null)} />
      ) : null}

      {isPickerOpen ? (
        <>
          <button
            type="button"
            className="app__scrim"
            aria-label={strings.history.close}
            onClick={() => setPickerOpen(false)}
          />
          <SessionPicker onClose={() => setPickerOpen(false)} />
        </>
      ) : null}

      {isMoveOpen ? (
        <>
          <button
            type="button"
            className="app__scrim"
            aria-label={strings.history.close}
            onClick={() => setMoveOpen(false)}
          />
          <SessionPicker
            title={strings.history.moveTitle}
            onPick={moveSelected}
            onClose={() => setMoveOpen(false)}
          />
        </>
      ) : null}
    </main>
  );
}

interface HistoryRowProps {
  solve: Solve;
  phases: readonly MethodPhase[];
  phaseKeys: readonly string[];
  bests: Bests;
  tagColors: string[];
  isSelected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
}

function HistoryRow({
  solve,
  phases,
  phaseKeys,
  bests,
  tagColors,
  isSelected,
  onToggleSelected,
  onOpen,
}: HistoryRowProps) {
  const at = now();
  const resultMs = finalMs(solve);
  // A DNF has no result, so it cannot be the best one however small its rawMs.
  const isBest = resultMs !== null && resultMs === bests.totalMs;
  const bestPhases = bestPhasesIn(solve, phaseKeys, bests);
  // Worth coming back to: it holds the best result, or the fastest one of its
  // phases has been. The whole row is lit rather than only the number, so the
  // ones to look at can be found without reading any of them.
  const holdsBest = isBest || bestPhases.length > 0;

  return (
    <li className={holdsBest ? 'history__row is-notable' : 'history__row'}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelected}
        aria-label={strings.history.select}
      />
      <button type="button" className="history__open" onClick={onOpen}>
        <span className={isBest ? 'history__time is-best' : 'history__time'}>
          {formatTime(resultMs)}
          {holdsBest ? (
            <span className="history__best" role="img" aria-label={strings.history.holdsBest}>
              ★
            </span>
          ) : null}
        </span>
        <span className="history__meta">
          {formatWhen(solve.createdAt, at)}
          {solve.starred === 1 ? ' ★' : ''}
          {solve.note ? ' ✎' : ''}
        </span>
        <span className="history__tags">
          {tagColors.map((color, index) => (
            <span key={index} className="history__dot" style={{ background: color }} />
          ))}
        </span>
        {/* Which phase the solve went in, and how much of it each one took —
            the question the history is read with. */}
        <SolvePhases solve={solve} phases={phases} detail="shares" bestPhases={bestPhases} />
      </button>
    </li>
  );
}
