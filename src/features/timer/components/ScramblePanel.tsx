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
  const [isPreviewShown] = useSetting('timer.showScramblePreview');
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
          {scramble === null ? (
            <p className="scramble__text">{strings.scramble.loading}</p>
          ) : (
            <ScrambleMoves scramble={scramble} />
          )}
          {scramble === null || !isPreviewShown ? null : mode === '3D' ? (
            <SpatialPreview scramble={scramble} />
          ) : isWatching ? (
            <SpatialPreview scramble={scramble} onDone={() => setWatched(null)} />
          ) : (
            <>
              <CubeDiagram
                className="scramble__preview"
                state={stateAfter(scramble)}
                view="net"
                // A scramble is defined from white on top and green in front;
                // the trainer's yellow-top view would be a different cube.
                skin={withWhiteTop(skin)}
                label={strings.scramble.label}
              />
              <button
                type="button"
                className="scramble__replay"
                onClick={() => setWatched(scramble)}
              >
                {strings.scramble.replay}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
});

/**
 * The scramble, one move per column. Turns are read a few at a time with a
 * cube already in hand, and a wall of proportional text loses the reader's
 * place; a grid keeps every move under the one above it. The space inside each
 * cell is there so that copying the scramble still gives back a scramble.
 */
function ScrambleMoves({ scramble }: { scramble: string }) {
  return (
    <p className="scramble__text scramble__moves">
      {scramble.split(' ').map((move, index) => (
        <span key={index + move}>{move + ' '}</span>
      ))}
    </p>
  );
}

function stateAfter(scramble: string) {
  const parsed = parseAlg(scramble);
  return parsed.ok ? applyAlg(solvedState(), parsed.moves) : solvedState();
}

/**
 * The cube in 3D. It has two jobs, and they differ only in where the animation
 * starts: as the preview it shows the scrambled cube and offers to replay the
 * scramble, and as the answer to "watch it" it plays straight away and hands
 * the flat picture back afterwards.
 *
 * These are cubing.js's colours either way — the player cannot be given a
 * skin — which is why the flat mode never falls back to it on its own.
 *
 * cubing/twisty is a heavy chunk; it loads after the first paint.
 */
function SpatialPreview({ scramble, onDone }: { scramble: string; onDone?: () => void }) {
  const player = useRef<TwistyPlayerElement | null>(null);
  const [isReady, setReady] = useState(false);
  const isWatching = onDone !== undefined;

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
    if (!isWatching) {
      element.jumpToEnd();
      return;
    }
    element.jumpToStart();
    element.play();
  }, [isReady, isWatching, scramble]);

  const replay = (): void => {
    player.current?.jumpToStart();
    player.current?.play();
  };

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
      <button type="button" className="scramble__replay" onClick={onDone ?? replay}>
        {isWatching ? strings.scramble.showPicture : strings.scramble.replay}
      </button>
    </>
  );
}
