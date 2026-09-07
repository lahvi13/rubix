import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { PlayIcon, StopIcon } from '../../../components/Icons';
import { parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import { useSetting } from '../../../hooks/use-setting';
import { usePlayingMove } from '../../../hooks/use-playing-move';
import { withWhiteTop } from '../../../lib/cube-skins';
import { CAMERA_LATITUDE, CAMERA_LONGITUDE } from '../../../lib/twisty-camera';
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
  // Which move the cube is turning while the scramble is played back. Null
  // whenever nothing is turning, which is the only gate it needs: the 3D
  // preview replays without going through `watched` at all.
  const [playingMove, setPlayingMove] = useState<number | null>(null);
  const isWatching = watched !== null && watched === scramble;

  // Drawn in the reader's own colours, flat or from a corner. The animated
  // cube paints its own, so it is only fetched when someone asks to watch.
  const picture =
    scramble === null ? null : (
      <CubeDiagram
        className="scramble__preview"
        state={stateAfter(scramble)}
        view={mode === '3D' ? 'isometric' : 'net'}
        // A scramble is defined from white on top and green in front; the
        // trainer's yellow-top view would be a different cube.
        skin={withWhiteTop(skin)}
        label={strings.scramble.label}
      />
    );

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
            <ScrambleMoves scramble={scramble} playingMove={playingMove} />
          )}
          {scramble === null || !isPreviewShown ? null : (
            /* The cube is the button. A label under it needed a line of its
               own on a screen that has none to spare, and it sat under the
               picture it belonged to. Both cubes share this box, so watching
               the scramble does not resize the screen under the thumb. */
            <button
              type="button"
              className="scramble__stage"
              aria-label={isWatching ? strings.scramble.showPicture : strings.scramble.replay}
              onClick={() => setWatched(isWatching ? null : scramble)}
            >
              {isWatching ? (
                <SpatialPreview
                  scramble={scramble}
                  onMove={setPlayingMove}
                  /* Until the player is ready the still cube stays up: there
                     is nothing to animate yet, and a "loading" line in its
                     place is a flash of empty screen. */
                  placeholder={picture}
                />
              ) : (
                picture
              )}
              <span className="scramble__play" aria-hidden="true">
                {isWatching ? <StopIcon /> : <PlayIcon />}
              </span>
            </button>
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
function ScrambleMoves({
  scramble,
  playingMove,
}: {
  scramble: string;
  playingMove: number | null;
}) {
  return (
    <p className="scramble__text scramble__moves">
      {scramble.split(' ').map((move, index) => (
        <span key={index + move} aria-current={index === playingMove ? 'step' : undefined}>
          {move + ' '}
        </span>
      ))}
    </p>
  );
}

function stateAfter(scramble: string) {
  const parsed = parseAlg(scramble);
  return parsed.ok ? applyAlg(solvedState(), parsed.moves) : solvedState();
}

/**
 * The scramble being performed, on a cube that turns. It plays as soon as it
 * is here — this is the answer to "watch it" — and hands the still picture
 * back when it is done.
 *
 * These are cubing.js's colours, not the reader's: the player cannot be given
 * a skin. That is the whole reason the still picture is drawn by us and this
 * only appears once someone asks for it, along with the weight of the chunk.
 */
function SpatialPreview({
  scramble,
  onMove,
  placeholder,
}: {
  scramble: string;
  onMove: (index: number | null) => void;
  placeholder: ReactNode;
}) {
  const player = useRef<TwistyPlayerElement | null>(null);
  const [isReady, setReady] = useState(false);

  usePlayingMove(player, isReady, onMove);

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

  if (!isReady) return placeholder;

  return (
    <twisty-player
      ref={player}
      className="scramble__player"
      puzzle="3x3x3"
      alg={scramble}
      experimental-setup-anchor="start"
      visualization="3D"
      background="none"
      camera-latitude={CAMERA_LATITUDE}
      camera-longitude={CAMERA_LONGITUDE}
      control-panel="none"
      hint-facelets="none"
    />
  );
}
