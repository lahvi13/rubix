import { useCallback } from 'react';
import { deleteTag, restoreTag, type DeletedTag } from '../../../db/repositories/tag-repository';
import { reportError, watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';
import { offerUndo } from '../../../lib/undo';

/**
 * Deleting a tag, with the way back the app offers for every other delete. It
 * is the offer that makes one press enough: a tag comes off every solve wearing
 * it at once, and the count next to the button says how many before it goes.
 */
export function useRemoveTag(): (id: string) => Promise<void> {
  return useCallback(async (id) => {
    let deleted: DeletedTag | null;
    try {
      deleted = await deleteTag(id);
    } catch (cause) {
      reportError(strings.solve.delete, cause);
      return;
    }
    if (deleted === null) return;

    const removed = deleted;
    offerUndo(strings.undo.tagDeleted(removed.tag.name), () => {
      watchWrite(() => restoreTag(removed), strings.undo.putBack);
    });
  }, []);
}
