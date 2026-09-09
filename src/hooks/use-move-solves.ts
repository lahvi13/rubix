import { useCallback } from 'react';
import type { Solve } from '../db/types';
import { moveSolves, restoreSolves } from '../db/repositories/solve-repository';
import { reportError, watchWrite } from '../lib/errors';
import { strings } from '../lib/strings';
import { offerUndo } from '../lib/undo';

/**
 * Filing solves under another session, with the same offer a delete makes: the
 * rows are somewhere else now, and for a few seconds they are one tap from
 * coming back. The move is worth taking back for the same reason it is worth
 * having — it is what a forgotten session switch leaves behind, and getting the
 * destination wrong twice in a row is the likeliest way to make it worse.
 */
export function useMoveSolves(): (
  ids: readonly string[],
  sessionId: string,
  sessionName: string,
) => Promise<void> {
  return useCallback(async (ids, sessionId, sessionName) => {
    let previous: Solve[];
    try {
      previous = await moveSolves(ids, sessionId);
    } catch (cause) {
      reportError(strings.history.moveTo, cause);
      return;
    }
    if (previous.length === 0) return;

    offerUndo(strings.undo.moved(previous.length, sessionName), () => {
      // Watched rather than awaited, as with a delete: the bar is already gone
      // from under the reader's thumb by the time the write lands.
      watchWrite(() => restoreSolves(previous), strings.undo.restoring);
    });
  }, []);
}
