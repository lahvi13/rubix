import { useState } from 'react';
import type { Penalty, Solve } from '../../../db/types';
import { finalMs } from '../../../domain/solve/final-time';
import { formatClock, formatTime } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useActiveSession } from '../../sessions';
import { usePhases } from '../../splits';
import { useHistory } from '../hooks/use-history';
import { useTags } from '../hooks/use-tags';
import { SolveDetail } from './SolveDetail';

const PUZZLE = '333';
const MODE = 'freestyle';
const PENALTY_FILTERS: Penalty[] = ['plus2', 'dnf'];

export function HistoryScreen() {
  const session = useActiveSession(PUZZLE, MODE);
  const history = useHistory(session?.id ?? null);
  const phases = usePhases(session?.methodId ?? null);
  const tags = useTags();
  const [openId, setOpenId] = useState<string | null>(null);
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
        {session?.name ?? ''} · {history.solves.length} / {history.total}
        {selected.size > 0 ? (
          <button type="button" className="is-danger" onClick={deleteSelected}>
            {strings.history.deleteSelected} ({selected.size})
          </button>
        ) : null}
      </p>

      {history.solves.length === 0 ? (
        <p className="solves__empty">{strings.history.empty}</p>
      ) : (
        <ol className="history">
          {history.solves.map((solve) => (
            <HistoryRow
              key={solve.id}
              solve={solve}
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
        // Keyed by solve id so opening another solve starts with fresh drafts
        // instead of syncing state in an effect.
        <SolveDetail
          key={open.id}
          solve={open}
          phases={phases}
          tags={tags.tags}
          onEdit={(id, patch) => void history.edit(id, patch)}
          onCreateTag={tags.create}
          onDelete={(id) => {
            void history.removeMany([id]);
            setOpenId(null);
          }}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </main>
  );
}

interface HistoryRowProps {
  solve: Solve;
  tagColors: string[];
  isSelected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
}

function HistoryRow({
  solve,
  tagColors,
  isSelected,
  onToggleSelected,
  onOpen,
}: HistoryRowProps) {
  return (
    <li className="history__row">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelected}
        aria-label={strings.history.select}
      />
      <button type="button" className="history__open" onClick={onOpen}>
        <span className="history__time">{formatTime(finalMs(solve))}</span>
        <span className="history__meta">
          {formatClock(solve.createdAt)}
          {solve.starred === 1 ? ' ★' : ''}
          {solve.note ? ' ✎' : ''}
        </span>
        <span className="history__tags">
          {tagColors.map((color, index) => (
            <span key={index} className="history__dot" style={{ background: color }} />
          ))}
        </span>
      </button>
    </li>
  );
}
