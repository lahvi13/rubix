import { memo, useEffect, useState } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import { strings } from '../../../lib/strings';

interface ScramblePanelProps {
  scramble: string | null;
  error: string | null;
  onRetry: () => void;
  /** Hidden while a solve is in progress — nothing must distract from the time. */
  hidden: boolean;
}

/**
 * Memoised, and hiding is done with CSS rather than by unmounting: tearing the
 * preview down would rebuild it on every single solve, and the timer above
 * repaints on animation frames — the panel must not be dragged through those
 * re-renders.
 *
 * The flat preview is drawn here from the app's own cube model, so it follows
 * the chosen skin and costs nothing to render. Only the 3D preview needs
 * cubing.js, and only if the user asked for it.
 */
export const ScramblePanel = memo(function ScramblePanel({
  scramble,
  error,
  onRetry,
  hidden,
}: ScramblePanelProps) {
  const [mode] = useSetting('ui.twistyMode');
  const skin = useCubeSkin();

  return (
    <div className={hidden ? 'scramble scramble--hidden' : 'scramble'} aria-hidden={hidden}>
      {error ? (
        <button type="button" className="scramble__error" onClick={onRetry}>
          {strings.scramble.failed}
        </button>
      ) : (
        <>
          <p className="scramble__text">{scramble ?? strings.scramble.loading}</p>
          {scramble === null ? null : mode === '3D' ? (
            <SpatialPreview scramble={scramble} />
          ) : (
            <CubeDiagram
              className="scramble__preview"
              state={stateAfter(scramble)}
              view="net"
              skin={skin}
              label={strings.scramble.label}
            />
          )}
        </>
      )}
    </div>
  );
});

function stateAfter(scramble: string) {
  const parsed = parseAlg(scramble);
  return parsed.ok ? applyAlg(solvedState(), parsed.moves) : solvedState();
}

/** cubing/twisty is a heavy chunk; it loads after the first paint. */
function SpatialPreview({ scramble }: { scramble: string }) {
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import('cubing/twisty').then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isReady) return null;

  return (
    <twisty-player
      className="scramble__preview scramble__preview--3d"
      puzzle="3x3x3"
      alg={scramble}
      visualization="3D"
      background="none"
      control-panel="none"
      hint-facelets="none"
    />
  );
}
