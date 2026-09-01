import { useState } from 'react';
import { strings } from '../../../lib/strings';
import { formatDate } from '../../../lib/format';
import { useSessions } from '../hooks/use-sessions';

const PUZZLE = '333';
const MODE = 'freestyle';

export function SessionsScreen() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { sessions, create, rename, activate, setArchived } = useSessions(includeArchived);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const submitNew = () => {
    const name = newName.trim();
    if (name === '') return;
    void create(name, PUZZLE, MODE);
    setNewName('');
  };

  const submitRename = (id: string) => {
    const name = editingName.trim();
    if (name !== '') void rename(id, name);
    setEditingId(null);
  };

  return (
    <main className="screen screen--scroll">
      <form
        className="session-form"
        onSubmit={(event) => {
          event.preventDefault();
          submitNew();
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

      <ul className="sessions">
        {sessions.map((session) => (
          <li
            key={session.id}
            className={session.isActive === 1 ? 'session session--active' : 'session'}
          >
            <div className="session__main">
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
                  onClick={() => void activate(session.id)}
                >
                  {session.name}
                  {session.isActive === 1 ? <span className="session__badge">active</span> : null}
                </button>
              )}
              <span className="session__meta">
                {session.solveCount} · {formatDate(session.createdAt)}
              </span>
            </div>

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
    </main>
  );
}
