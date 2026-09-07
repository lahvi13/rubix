import { useEffect, useState } from 'react';
import { strings } from '../lib/strings';
import { clearUndo, onUndoOffer, pendingUndo, takeUndo, type UndoOffer } from '../lib/undo';

/**
 * How long a delete can be taken back. Long enough to notice the mistake and
 * reach the button on a phone, short enough that the bar is gone before it is
 * in the way of the next solve.
 */
const UNDO_SECONDS = 5;

/**
 * The offer to put back what was just deleted. Lives next to the error banner
 * because it is the same kind of thing: always mounted, above whichever screen
 * happens to be open.
 */
export function UndoBar() {
  const [offer, setOffer] = useState<UndoOffer | null>(pendingUndo);
  const [remaining, setRemaining] = useState(UNDO_SECONDS);

  useEffect(
    () =>
      onUndoOffer((next) => {
        setOffer(next);
        setRemaining(UNDO_SECONDS);
      }),
    [],
  );

  useEffect(() => {
    if (offer === null) return;
    if (remaining === 0) {
      clearUndo();
      return;
    }
    const handle = setTimeout(() => setRemaining((seconds) => seconds - 1), 1000);
    return () => clearTimeout(handle);
  }, [offer, remaining]);

  if (offer === null) return null;

  return (
    <div className="undo-bar" role="status">
      <span className="undo-bar__message">{offer.message}</span>
      <button type="button" className="is-primary" onClick={takeUndo}>
        {strings.undo.action} ({remaining})
      </button>
    </div>
  );
}
