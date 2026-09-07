import { useCallback } from 'react';
import type { Solve } from '../db/types';
import { deleteSolves, restoreSolves } from '../db/repositories/solve-repository';
import { reportError, watchWrite } from '../lib/errors';
import { strings } from '../lib/strings';
import { offerUndo } from '../lib/undo';

/**
 * Deleting solves, from wherever they are deleted — the timer's list, the
 * history, a case's attempts. One place, because the promise the app makes
 * afterwards has to be the same everywhere: the rows are gone, and for a few
 * seconds they are one tap from coming back.
 *
 * Why undo rather than a dialog: a mistimed solve is deleted right after it
 * happens, hands still on the cube, and a confirmation would tax every one of
 * those to protect against the rare slip — which it does not protect against
 * anyway, since a dialog that appears every time is a dialog that gets
 * dismissed by reflex.
 */
export function useRemoveSolves(): (ids: readonly string[]) => Promise<void> {
  const remove = useUndoableDelete();
  return useCallback((ids) => remove(() => deleteSolves([...ids])), [remove]);
}

/**
 * The same offer for a delete the caller states its own way — "everything
 * drilled on this case" is a query, not a list of ids the screen happens to be
 * showing. The delete must report the rows it removed; that is what makes it
 * undoable.
 */
export function useUndoableDelete(): (deleting: () => Promise<Solve[]>) => Promise<void> {
  return useCallback((deleting: () => Promise<Solve[]>) => runUndoableDelete(deleting), []);
}

async function runUndoableDelete(deleting: () => Promise<Solve[]>): Promise<void> {
  let removed: Solve[];
  try {
    removed = await deleting();
  } catch (cause) {
    reportError(strings.solve.delete, cause);
    return;
  }
  if (removed.length === 0) return;

  offerUndo(strings.undo.deleted(removed.length), () => {
    // Watched rather than awaited: the user has already turned away from the
    // bar, and a restore lost to a phone closing the connection would look
    // exactly like an undo that did nothing.
    watchWrite(() => restoreSolves(removed), strings.undo.restoring);
  });
}
