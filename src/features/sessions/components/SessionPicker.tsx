import { useState } from 'react';
import { CloseIcon } from '../../../components/Icons';
import { useKeyCapture } from '../../../hooks/use-key-capture';
import { formatDate } from '../../../lib/format';
import { strings } from '../../../lib/strings';
import { useSessions } from '../hooks/use-sessions';

const PUZZLE = '333';
const MODE = 'freestyle';

interface SessionPickerProps {
  onClose: () => void;
}

/**
 * Switching sessions, opened from wherever a session's name is written — the
 * timer, the history, the stats. The picked session becomes the active one,
 * so there is a single session in play rather than a viewed one alongside the
 * one being timed into. Anything that changes which session that is closes the
 * sheet: the answer to why it was opened is on the screen underneath.
 */
export function SessionPicker({ onClose }: SessionPickerProps) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { sessions, create, rename, activate, setArchived } = useSessions(includeArchived);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useKeyCapture(true, onClose);

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

  const pick = async (id: string) => {
    await activate(id);
    onClose();
  };

  return (
    <aside className="detail session-picker" role="dialog" aria-label={strings.sessions.title}>
      <div className="detail__header detail__header--bare">
        <button
          type="button"
          className="detail__close"
          onClick={onClose}
          aria-label={strings.history.close}
        >
          <CloseIcon />
        </button>
      </div>

      <h2 className="session-picker__title">{strings.sessions.title}</h2>

      <ul className="sessions">
        {sessions.map((session) => (
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
                onClick={() => void pick(session.id)}
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
            </div>
          </li>
        ))}
      </ul>

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
    </aside>
  );
}
