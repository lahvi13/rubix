import { memo, useEffect, useRef, useState } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import { withWhiteTop } from '../../../lib/cube-skins';
import { strings } from '../../../lib/strings';
import type { TwistyPlayerElement } from '../../../types/twisty';

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
              // A scramble is defined from white on top and green in front;
              // the trainer's yellow-top view would be a different cube.
              skin={withWhiteTop(skin)}
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

/**
 * The scramble in 3D, and a button to watch it being applied — a still picture
 * of a scrambled cube never says which way round it started.
 *
 * cubing/twisty is a heavy chunk; it loads after the first paint.
 */
function SpatialPreview({ scramble }: { scramble: string }) {
  const player = useRef<TwistyPlayerElement | null>(null);
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

  // The preview shows the scrambled cube; the animation is on request.
  useEffect(() => {
    if (!isReady) return;
    player.current?.jumpToEnd();
  }, [isReady, scramble]);

  if (!isReady) return null;

  return (
    <>
      <twisty-player
        ref={player}
        className="scramble__preview scramble__preview--3d"
        puzzle="3x3x3"
        alg={scramble}
        experimental-setup-anchor="start"
        visualization="3D"
        background="none"
        control-panel="none"
        hint-facelets="none"
      />
      <button
        type="button"
        className="scramble__replay"
        onClick={() => {
          player.current?.jumpToStart();
          player.current?.play();
        }}
      >
        {strings.scramble.replay}
      </button>
    </>
  );
}
