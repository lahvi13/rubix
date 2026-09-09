import { useState } from 'react';
import { Sheet } from '../../../components/Sheet';
import { formatDate } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useRemoveSession } from '../hooks/use-remove-session';
import { useSessions } from '../hooks/use-sessions';

const PUZZLE = '333';
const MODE = 'freestyle';

interface SessionPickerProps {
  onClose: () => void;
  /**
   * Given, the sheet chooses a session instead of switching to one: it hands
   * the id back and leaves the active session alone. Without it, choosing and
   * switching are the same act — which is the point everywhere else, and
   * exactly wrong when the session being named is a destination.
   */
  onPick?: (sessionId: string, name: string) => void;
  /** What the choice is for. The sheet has no idea, so the caller says. */
  title?: string;
}

/**
 * Switching sessions, opened from wherever a session's name is written — the
 * timer, the history, the stats. The picked session becomes the active one,
 * so there is a single session in play rather than a viewed one alongside the
 * one being timed into. Anything that changes which session that is closes the
 * sheet: the answer to why it was opened is on the screen underneath.
 */
export function SessionPicker({ onClose, onPick, title }: SessionPickerProps) {
  const isChoosing = onPick !== undefined;
  const [includeArchived, setIncludeArchived] = useState(false);
  const { sessions, create, rename, activate, setArchived } = useSessions(
    isChoosing ? false : includeArchived,
  );
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const removeSession = useRemoveSession();

  // A destination is somewhere else by definition. The solves on offer come
  // from the screen underneath, which shows the active session and nothing
  // else, so the active one is the source rather than a place to put them.
  const listed = isChoosing ? sessions.filter((session) => session.isActive === 0) : sessions;

  const submitNew = async () => {
    const name = newName.trim();
    if (name === '') return;
    setNewName('');
    await create(name, PUZZLE, MODE);
    onClose();
  };

  const submitRename = (id: string) => {
    const name = editingName.trim();
    if (name !== '') void rename(id, name);
    setEditingId(null);
  };

  const choose = async (id: string, name: string) => {
    if (onPick) onPick(id, name);
    else await activate(id);
    onClose();
  };

  return (
    <Sheet label={title ?? strings.sessions.title} className="session-picker" onClose={onClose}>
      <h2 className="session-picker__title">{title ?? strings.sessions.title}</h2>

      {listed.length === 0 ? <p className="detail__hint">{strings.sessions.noOther}</p> : null}

      <ul className="sessions">
        {listed.map((session) => (
          <li
            key={session.id}
            className={session.isActive === 1 ? 'session session--active' : 'session'}
          >
            {editingId === session.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onBlur={() => submitRename(session.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitRename(session.id);
                  if (event.key === 'Escape') setEditingId(null);
                }}
                aria-label={strings.sessions.rename}
              />
            ) : (
              <button
                type="button"
                className="session__name"
                aria-current={session.isActive === 1 ? 'true' : undefined}
                onClick={() => void choose(session.id, session.name)}
              >
                <span className="session__label">
                  {session.name}
                  {session.isActive === 1 ? (
                    <span className="session__badge">{strings.sessions.activeBadge}</span>
                  ) : null}
                </span>
                <span className="session__meta">
                  {strings.sessions.solveCount(session.solveCount)} · {formatDate(session.createdAt)}
                </span>
              </button>
            )}

            {/* Renaming and archiving belong to keeping sessions, not to
                choosing one: a sheet asking where solves should go offers
                nothing that changes the answer. */}
            {isChoosing ? null : (
              <div className="session__actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(session.id);
                    setEditingName(session.name);
                  }}
                >
                  {strings.sessions.rename}
                </button>
                <button
                  type="button"
                  onClick={() => void setArchived(session.id, session.isArchived === 0)}
                >
                  {session.isArchived === 1 ? strings.sessions.restore : strings.sessions.archive}
                </button>
                <button type="button" onClick={() => setConfirmingId(session.id)}>
                  {strings.solve.delete}
                </button>
              </div>
            )}

            {/* What goes with the session is spelled out before it goes: the
                solves leave the averages and the personal best with it, and
                unlike archiving there is nothing to undo afterwards. */}
            {confirmingId === session.id ? (
              <div className="session__confirm">
                <p>{strings.sessions.deleteWarning(session.solveCount)}</p>
                <div className="session__actions">
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => {
                      setConfirmingId(null);
                      void removeSession(session.id);
                    }}
                  >
                    {strings.sessions.confirmDelete}
                  </button>
                  <button type="button" onClick={() => setConfirmingId(null)}>
                    {strings.sessions.cancel}
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {isChoosing ? null : (
        <>
          <label className="toggle">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
            {strings.sessions.showArchived}
          </label>

          <form
            className="session-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitNew();
            }}
          >
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={strings.sessions.namePlaceholder}
              aria-label={strings.sessions.namePlaceholder}
            />
            <button type="submit">{strings.sessions.create}</button>
          </form>
        </>
      )}
    </Sheet>
  );
}
