import { useCallback } from 'react';
import {
  deleteSession,
  restoreSession,
  type DeletedSession,
} from '../../../db/repositories/session-repository';
import { reportError, watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { offerUndo } from '../../../lib/undo';

/**
 * Deleting a session and everything timed into it. The offer to put it back is
 * the second net rather than the only one: the card asks once more first,
 * because a whole session's solves is more than five seconds of attention is
 * worth betting on.
 */
export function useRemoveSession(): (id: string) => Promise<void> {
  return useCallback(async (id) => {
    let deleted: DeletedSession | null;
    try {
      deleted = await deleteSession(id);
    } catch (cause) {
      reportError(strings.sessions.confirmDelete, cause);
      return;
    }
    if (deleted === null) return;

    const removed = deleted;
    offerUndo(strings.undo.sessionDeleted(removed.session.name, removed.solves.length), () => {
      watchWrite(() => restoreSession(removed), strings.undo.putBack);
    });
  }, []);
}
