import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { CubeDiagram } from '../../../components/CubeDiagram';
import { CloseIcon, PlayIcon, StopIcon } from '../../../components/Icons';
import { parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import { useCubeSkin } from '../../../hooks/use-cube-skin';
import type { PinSource } from '../../../hooks/use-pinned-scramble';
import { useSetting } from '../../../hooks/use-setting';
import { usePlayingMove } from '../../../hooks/use-playing-move';
import { useTwistySkin } from '../../../hooks/use-twisty-skin';
import { withWhiteTop } from '../../../lib/cube-skins';
import { CAMERA_LATITUDE, CAMERA_LONGITUDE } from '../../../lib/twisty-view';
import { strings } from '../../../lib/strings';
import type { TwistyPlayerElement } from '../../../types/twisty';

interface ScramblePanelProps {
  scramble: string | null;
  error: string | null;
  onRetry: () => void;
  /** Hidden while a solve is in progress — nothing must distract from the time. */
  hidden: boolean;
  /** Where the scramble came from when the timer did not generate it; null when it did. */
  pinnedSource: PinSource | null;
  /** The scramble was tapped: the reader wants to type, paste or copy one. Kept stable. */
  onEdit: () => void;
  /** Back to the generated scramble. Kept stable. */
  onUnpin: () => void;
}

/**
 * Memoised, and hiding is done with CSS rather than by unmounting: tearing the
 * preview down would rebuild it on every single solve, and the timer above
 * repaints on animation frames — the panel must not be dragged through those
 * re-renders.
 *
 * The preview is drawn here from the app's own cube model, so it follows the
 * chosen skin and costs nothing to render. cubing.js is a heavy chunk, so the
 * 3D mode does not replace the picture — it adds a button that plays the
 * scramble and hands the picture back afterwards.
 */
export const ScramblePanel = memo(function ScramblePanel({
  scramble,
  error,
  onRetry,
  hidden,
  pinnedSource,
  onEdit,
  onUnpin,
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
  // cube is only fetched when someone asks to watch.
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
        isEager
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
            <ScramblePlaceholder />
          ) : (
            /* The scramble itself is what is tapped to change it: a pencil
               beside it would be one more control on the one screen that must
               stay quiet, and it would have nowhere to go with the cube hidden. */
            <button
              type="button"
              className="scramble__edit"
              aria-label={strings.scramble.edit(scramble)}
              onClick={onEdit}
            >
              <ScrambleMoves scramble={scramble} playingMove={playingMove} />
            </button>
          )}
          {pinnedSource === null || scramble === null ? null : (
            /* Said out loud, because a scramble the reader did not ask the
               app for is one they may have forgotten they chose. */
            <p className="scramble__pinned">
              {pinnedSource === 'own' ? strings.scramble.own : strings.scramble.fromHistory}
              <button
                type="button"
                className="scramble__unpin"
                aria-label={strings.scramble.unpin}
                title={strings.scramble.unpin}
                onClick={onUnpin}
              >
                <CloseIcon />
              </button>
            </p>
          )}
          {scramble === null && isPreviewShown ? (
            /* A grey cube in the box the scramble's cube will take, so the
               screen looks finished while the scramble is still computed. */
            <div className="scramble__stage" aria-hidden="true">
              <CubeDiagram
                className="scramble__preview"
                state={solvedState()}
                view={mode === '3D' ? 'isometric' : 'net'}
                stickering="blank"
                skin={skin}
                label={null}
                isEager
              />
            </div>
          ) : null}
          {scramble === null || !isPreviewShown ? null : (
            /* The cube is the button. A label under it needed a line of its
               own on a screen that has none to spare, and it sat under the
               picture it belonged to. Both cubes share this box, so watching
               the scramble does not resize the screen under the thumb. */
            <button
              type="button"
              className={isWatching ? 'scramble__stage is-watching' : 'scramble__stage'}
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
    <span className="scramble__text scramble__moves">
      {scramble.split(' ').map((move, index) => (
        <span key={index + move} aria-current={index === playingMove ? 'step' : undefined}>
          {move + ' '}
        </span>
      ))}
    </span>
  );
}

/** A scramble's worth of moves: 3×3 random-state scrambles run 19 to 21. */
const PLACEHOLDER_MOVES = Array.from({ length: 20 }, () => 'R2 ');

/**
 * What stands in while the first scramble is generated: the words, over an
 * invisible grid of as many rows as a scramble fills. A one-line "generating"
 * that the scramble then grew out of pushed the clock and the list down the
 * screen a second into every visit — the largest layout shift the app had.
 */
function ScramblePlaceholder() {
  return (
    <div className="scramble__placeholder">
      <p className="scramble__text scramble__moves" aria-hidden="true">
        {PLACEHOLDER_MOVES.map((move, index) => (
          <span key={index}>{move}</span>
        ))}
      </p>
      <p className="scramble__text scramble__loading">{strings.scramble.loading}</p>
    </div>
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
 * Only fetched once someone asks for it: the still picture costs nothing, and
 * this brings the whole of cubing/twisty with it.
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
  useTwistySkin(player, isReady);

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
