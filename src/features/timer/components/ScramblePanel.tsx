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
 * The preview is drawn here from the app's own cube model, so it follows the
 * chosen skin and costs nothing to render. cubing.js paints its own colours
 * and cannot be given a skin, so the 3D mode does not replace the picture —
 * it adds a button that plays the scramble and hands the picture back
 * afterwards.
 */
export const ScramblePanel = memo(function ScramblePanel({
  scramble,
  error,
  onRetry,
  hidden,
}: ScramblePanelProps) {
  const [mode] = useSetting('ui.twistyMode');
  const skin = useCubeSkin();
  // Which scramble is being watched, rather than a flag: a new scramble means
  // a new cube to look at, not the previous animation still running.
  const [watched, setWatched] = useState<string | null>(null);
  const isWatching = watched !== null && watched === scramble;

  return (
    <div className={hidden ? 'scramble scramble--hidden' : 'scramble'} aria-hidden={hidden}>
      {error ? (
        <button type="button" className="scramble__error" onClick={onRetry}>
          {strings.scramble.failed}
        </button>
      ) : (
        <>
          <p className="scramble__text">{scramble ?? strings.scramble.loading}</p>
          {scramble === null ? null : isWatching ? (
            <SpatialPreview scramble={scramble} onDone={() => setWatched(null)} />
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
          {scramble !== null && mode === '3D' && !isWatching ? (
            <button type="button" className="scramble__replay" onClick={() => setWatched(scramble)}>
              {strings.scramble.replay}
            </button>
          ) : null}
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
 * The scramble being applied, move by move — a still picture never says which
 * way round the cube started. Shown on request only, because these are
 * cubing.js's colours, not the chosen skin's.
 *
 * cubing/twisty is a heavy chunk; it loads after the first paint.
 */
function SpatialPreview({ scramble, onDone }: { scramble: string; onDone: () => void }) {
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

  useEffect(() => {
    if (!isReady) return;
    const element = player.current;
    if (!element) return;
    element.jumpToStart();
    element.play();
  }, [isReady, scramble]);

  if (!isReady) return <p className="scramble__loading">{strings.trainer.loadingPlayer}</p>;

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
      <button type="button" className="scramble__replay" onClick={onDone}>
        {strings.scramble.showPicture}
      </button>
    </>
  );
}
