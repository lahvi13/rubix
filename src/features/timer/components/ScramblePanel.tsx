import { useEffect, useState } from 'react';
import { strings } from '../../../lib/strings';

interface ScramblePanelProps {
  scramble: string | null;
  error: string | null;
  onRetry: () => void;
  /** Hidden while a solve is in progress — nothing must distract from the time. */
  hidden: boolean;
}

export function ScramblePanel({ scramble, error, onRetry, hidden }: ScramblePanelProps) {
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

  if (hidden) return <div className="scramble scramble--hidden" aria-hidden="true" />;

  if (error) {
    return (
      <div className="scramble">
        <button type="button" className="scramble__error" onClick={onRetry}>
          {strings.scramble.failed}
        </button>
      </div>
    );
  }

  return (
    <div className="scramble">
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
    </div>
  );
}
