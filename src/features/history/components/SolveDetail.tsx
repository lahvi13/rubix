import { useState } from 'react';
import { Sheet, type SheetPaging } from '../../../components/Sheet';
import type { MethodPhase, Solve, Tag } from '../../../db/types';
import type { SolvePatch } from '../../../db/repositories/solve-repository';
import { finalMs } from '../../../domain/solve/final-time';
import { bestPhasesIn, type Bests } from '../../../domain/stats/phases';
import { parseTimeInput } from '../../../domain/solve/parse-time';
import { togglePenalty } from '../../../domain/solve/penalty';
import { formatDateTime, formatMs, formatResult } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { SplitEditor } from '../../splits';

interface SolveDetailProps {
  solve: Solve;
  phases: readonly MethodPhase[];
  tags: Tag[];
  onEdit: (id: string, patch: SolvePatch) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  onDelete: (id: string) => void;
  /** Opens the choice of where to file it; the sheet handles the rest. */
  onMove: () => void;
  paging?: SheetPaging;
  /** The session's records, so the solve can say which of them it holds. */
  bests: Bests;
  globalPbMs: number | null;
  /** Which session it belongs to — it need not be the one being read. */
  sessionName: string | null;
  /** Given, the scramble can be taken back to the timer and solved again. */
  onSolveAgain?: () => void;
  onClose: () => void;
}

export function SolveDetail({
  solve,
  phases,
  tags,
  onEdit,
  onCreateTag,
  onDelete,
  onMove,
  paging,
  bests,
  globalPbMs,
  sessionName,
  onSolveAgain,
  onClose,
}: SolveDetailProps) {
  const [timeInput, setTimeInput] = useState(() => formatMs(solve.rawMs));
  const [timeError, setTimeError] = useState(false);
  const [note, setNote] = useState(solve.note ?? '');
  const [newTag, setNewTag] = useState('');

  const resultMs = finalMs(solve);
  const isBest = resultMs !== null && resultMs === bests.totalMs;
  const isPb = resultMs !== null && resultMs === globalPbMs;
  const bestPhases = bestPhasesIn(solve, phases.map((phase) => phase.key), bests);

  const commitTime = () => {
    const parsed = parseTimeInput(timeInput);
    if (parsed === null) {
      setTimeError(true);
      return;
    }
    setTimeError(false);
    if (parsed !== solve.rawMs) onEdit(solve.id, { rawMs: parsed });
  };

  const toggleTag = (tagId: string) => {
    const next = solve.tagIds.includes(tagId)
      ? solve.tagIds.filter((id) => id !== tagId)
      : [...solve.tagIds, tagId];
    onEdit(solve.id, { tagIds: next });
  };

  const addTag = async () => {
    const name = newTag.trim();
    if (name === '') return;
    const existing = tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
    const tag = existing ?? (await onCreateTag(name));
    setNewTag('');
    if (!solve.tagIds.includes(tag.id)) onEdit(solve.id, { tagIds: [...solve.tagIds, tag.id] });
  };

  return (
    <Sheet label={strings.history.detailTitle} paging={paging} onClose={onClose}>
      <span
        className={
          isPb ? 'detail__result is-best is-record' : isBest ? 'detail__result is-best' : 'detail__result'
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

      <p className="detail__scramble">{solve.scramble}</p>
      {/* A time on a scramble somebody chose is not the claim a random one
          makes — it may have been practised — so the solve keeps saying so. */}
      {solve.scrambleSource === 'generated' ? null : (
        <p className="detail__scramble-source">
          {solve.scrambleSource === 'own' ? strings.scramble.own : strings.scramble.fromHistory}
        </p>
      )}
      {onSolveAgain === undefined ? null : (
        <button type="button" className="detail__again" onClick={onSolveAgain}>
          {strings.history.solveAgain}
        </button>
      )}

      <div className="detail__row">
        <label htmlFor="detail-time">{strings.history.rawTime}</label>
        <input
          id="detail-time"
          value={timeInput}
          onChange={(event) => setTimeInput(event.target.value)}
          onBlur={commitTime}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitTime();
          }}
          className={timeError ? 'is-invalid' : ''}
          inputMode="decimal"
        />
        {timeError ? <span className="detail__error">{strings.history.invalidTime}</span> : null}
      </div>

      <div className="detail__row detail__row--buttons">
        <button
          type="button"
          aria-label={`${strings.history.penaltyLabel} ${strings.solve.plusTwo}`}
          className={solve.penalty === 'plus2' ? 'is-active' : ''}
          onClick={() => onEdit(solve.id, { penalty: togglePenalty(solve.penalty, 'plus2') })}
        >
          {strings.solve.plusTwo}
        </button>
        <button
          type="button"
          aria-label={`${strings.history.penaltyLabel} ${strings.solve.dnf}`}
          className={solve.penalty === 'dnf' ? 'is-active' : ''}
          onClick={() => onEdit(solve.id, { penalty: togglePenalty(solve.penalty, 'dnf') })}
        >
          {strings.solve.dnf}
        </button>
        <button
          type="button"
          aria-label={strings.history.markSolve}
          className={solve.starred === 1 ? 'is-active' : ''}
          onClick={() => onEdit(solve.id, { starred: solve.starred === 1 ? 0 : 1 })}
        >
          {strings.history.mark}
        </button>
      </div>

      {phases.length > 0 ? (
        <div className="detail__row">
          <span>{strings.splits.title}</span>
          {solve.splits.length === 0 ? (
            <p className="detail__hint">{strings.splits.none}</p>
          ) : null}
          <SplitEditor
            solve={solve}
            phases={phases}
            bestPhases={bestPhases}
            onChange={(splits) =>
              onEdit(solve.id, { splits, phaseKeys: phases.map((phase) => phase.key) })
            }
          />
        </div>
      ) : null}

      <div className="detail__row">
        <span>{strings.history.tags}</span>
        <div className="detail__tags">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={solve.tagIds.includes(tag.id) ? 'tag tag--on' : 'tag'}
              style={{ borderColor: tag.color }}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
        <div className="detail__tag-add">
          <input
            value={newTag}
            onChange={(event) => setNewTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void addTag();
              }
            }}
            placeholder={strings.history.newTag}
            aria-label={strings.history.newTag}
          />
          <button type="button" onClick={() => void addTag()}>
            +
          </button>
        </div>
      </div>

      <div className="detail__row">
        <label htmlFor="detail-note">{strings.history.note}</label>
        <textarea
          id="detail-note"
          value={note}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => onEdit(solve.id, { note: note.trim() === '' ? null : note })}
        />
      </div>

      <footer className="detail__footer">
        <span className="detail__meta">
          {/* Which session, because a solve can be opened from the stats and
              that one may well have been set in another. */}
          {sessionName === null ? '' : `${sessionName} · `}
          {formatDateTime(solve.createdAt)}
          {solve.inspectionMs === null
            ? ''
            : ` · ${strings.history.inspection} ${formatMs(solve.inspectionMs)}`}
          {solve.editedAt === null ? '' : ` · ${strings.history.edited}`}
        </span>
        <div className="detail__footer-actions">
          <button type="button" onClick={onMove}>
            {strings.history.moveTo}
          </button>
          <button type="button" className="is-danger" onClick={() => onDelete(solve.id)}>
            {strings.solve.delete}
          </button>
        </div>
      </footer>
    </Sheet>
  );
}
