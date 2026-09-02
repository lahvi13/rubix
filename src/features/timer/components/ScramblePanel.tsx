import { memo, useEffect, useState } from 'react';
import { strings } from '../../../lib/strings';

interface ScramblePanelProps {
  scramble: string | null;
  error: string | null;
  onRetry: () => void;
  /** Hidden while a solve is in progress — nothing must distract from the time. */
  hidden: boolean;
}

/**
 * Memoised, and hiding is done with CSS rather than by unmounting: tearing
 * the twisty-player down would recreate the whole custom element on every
 * single solve, and the timer above repaints on animation frames — the panel
 * must not be dragged through those re-renders.
 */
export const ScramblePanel = memo(function ScramblePanel({
  scramble,
  error,
  onRetry,
  hidden,
}: ScramblePanelProps) {
  const [previewReady, setPreviewReady] = useState(false);

  // cubing/twisty is a heavy chunk; load it after the first paint so the
  // timer is usable immediately.
  useEffect(() => {
    let cancelled = false;
    void import('cubing/twisty').then(() => {
      if (!cancelled) setPreviewReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={hidden ? 'scramble scramble--hidden' : 'scramble'} aria-hidden={hidden}>
      {error ? (
        <button type="button" className="scramble__error" onClick={onRetry}>
          {strings.scramble.failed}
        </button>
      ) : (
        <>
          <p className="scramble__text">{scramble ?? strings.scramble.loading}</p>
          {previewReady && scramble ? (
            <twisty-player
              className="scramble__preview"
              puzzle="3x3x3"
              alg={scramble}
              visualization="2D"
              background="none"
              control-panel="none"
              hint-facelets="none"
            />
          ) : null}
        </>
      )}
    </div>
  );
});
