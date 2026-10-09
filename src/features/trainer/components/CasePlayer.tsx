import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TwistyPlayerElement } from '../../../types/twisty';
import type { PlaybackPosition, PlaybackRequest } from '../../../hooks/use-playback';
import { usePlayWhenDrawn } from '../../../hooks/use-play-when-drawn';
import { usePlayingMove } from '../../../hooks/use-playing-move';
import { useTwistySkin } from '../../../hooks/use-twisty-skin';
import { strings } from '../../../lib/strings';
import { CAMERA_LATITUDE, CAMERA_LONGITUDE, CUBE_ORIENTATION } from '../../../lib/twisty-view';
import {
  maskByHome,
  maskHidingLayer,
  maskHidingLayerPieces,
  maskKeepingLayer,
  maskOrientingLayer,
  type ShownFace,
  type StickeringMask,
} from '../../../lib/twisty-stickering';

/**
 * What the moving cube shows: everything; only the two layers a case is built
 * in, with the last layer greyed out the way the still picture greys it; only
 * the last layer's yellow, the way an OLL picture reads, or the yellow of its
 * edges alone for the first look; or, for the beginner's
 * steps, just the pieces the step is about — the cross, the bottom layer
 * being built, or the last layer's corners without its edges. Roux's steps
 * each have their own: the left block, both blocks, the corners' yellow, and
 * the top and bottom colours of the last six edges.
 */
export type PlayerStickering =
  | 'full'
  | 'firstTwoLayers'
  | 'orientation'
  | 'edgeOrientation'
  | 'cross'
  | 'bottomLayer'
  | 'lastLayerCorners'
  | 'leftBlock'
  | 'blocks'
  | 'blocksAndCorners'
  | 'cornerOrientation'
  | 'lseOrientation';

interface CasePlayerProps {
  /** How the cube gets into the case: the algorithm, undone. */
  setupAlg: string;
  alg: string;
  stickering: PlayerStickering;
  /** What the buttons last asked the cube to do. */
  request: PlaybackRequest;
  /** Which move is turning, so the written algorithm can say where the cube is. */
  onMove: (index: number | null) => void;
  /**
   * The cube has come to rest, and where. Played to the end, the algorithm
   * has been performed: the cube is solved by then — the case is over — so
   * the still picture of the case is what belongs on screen again.
   */
  onStopped: (at: PlaybackPosition) => void;
  /**
   * The rotation at the head of `setupAlg`, said apart as well: a mask that
   * picks out the left block has to know which side that is.
   */
  standing?: string;
  /** Looked at from the front-left, for Roux's first block; the front-right otherwise. */
  isFromLeft?: boolean;
  /**
   * Shown while the player's chunk arrives. Where the player takes a still
   * picture's place, that picture is better than a line of text: a flash of
   * "loading" where a cube just was reads as the cube having gone.
   */
  placeholder?: ReactNode;
}

/**
 * The algorithm, running. This is the one place a twisty-player earns its
 * weight — a still picture is drawn far more cheaply by CubeDiagram, but
 * nothing else shows what the moves do to the cube.
 */
export function CasePlayer({
  setupAlg,
  alg,
  stickering,
  standing = '',
  isFromLeft = false,
  request,
  onMove,
  onStopped,
  placeholder,
}: CasePlayerProps) {
  const player = useRef<TwistyPlayerElement | null>(null);
  const [isReady, setReady] = useState(false);
  const [mask, setMask] = useState<StickeringMask | null>(null);

  // cubing/twisty is a heavy chunk and the trainer is usable without it, so it
  // is only fetched once someone actually asks to see a case move. The mask is
  // worked out alongside, so the cube is built wearing it rather than showing
  // every colour for its first few frames.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([import('cubing/twisty'), maskFor(stickering, standing)]).then(
      ([, nextMask]) => {
        if (cancelled) return;
        setMask(nextMask);
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [stickering, standing]);

  useEffect(() => {
    const element = player.current;
    if (!isReady || !element || mask === null) return;
    element.experimentalStickeringMaskOrbits = mask;
  }, [isReady, mask]);

  usePlayingMove(player, isReady, onMove, onStopped);
  useTwistySkin(player, isReady);
  const isDrawn = usePlayWhenDrawn(player, isReady, request);

  const waiting = placeholder ?? (
    <p className="case-player__loading">{strings.trainer.loadingPlayer}</p>
  );
  if (!isReady) return waiting;

  return (
    <>
      {/* Under the player, until its cube has faded in over it. */}
      {isDrawn ? null : waiting}
      <twisty-player
        ref={player}
        className="case-player"
        // Dragging this turns the cube. A swipe that spun it instead of
        // turning the page would be maddening, so the sheet skips it.
        data-no-swipe=""
        puzzle="3x3x3"
        alg={alg}
        experimental-setup-alg={`${CUBE_ORIENTATION} ${setupAlg}`}
        experimental-setup-anchor="start"
        visualization="3D"
        background="none"
        camera-latitude={CAMERA_LATITUDE}
        // Mirrored for the left block, which the usual corner cannot see.
        camera-longitude={isFromLeft ? -CAMERA_LONGITUDE : CAMERA_LONGITUDE}
        control-panel="none"
        hint-facelets="none"
      />
    </>
  );
}

/**
 * Handed over rather than named: the cube stands yellow up, and cubing.js
 * names its stickerings for a cube standing the other way. Its last layer is
 * cubing.js's D.
 */
/**
 * In cubing.js's frame, where the cube stands on its head (`CUBE_ORIENTATION`):
 * our last layer is its D, and the bottom layer built first is its U.
 */
function maskFor(stickering: PlayerStickering, standing: string): Promise<StickeringMask | null> {
  // Roux's masks are decided on the cube as shown, yellow up and turned the
  // way the case is held — where the left block is depends on both.
  const shown = `${CUBE_ORIENTATION} ${standing}`;
  const isBlock = (home: ReadonlySet<ShownFace>) =>
    (home.has('L') || home.has('R')) && !home.has('U');
  const isLeftBlock = (home: ReadonlySet<ShownFace>) => home.has('L') && !home.has('U');

  switch (stickering) {
    case 'full':
      return Promise.resolve(null);
    case 'firstTwoLayers':
      return maskHidingLayer('D');
    case 'orientation':
      return maskOrientingLayer('D');
    case 'edgeOrientation':
      return maskOrientingLayer('D', 'EDGES');
    case 'cross':
      return maskKeepingLayer('U', 'EDGES');
    case 'bottomLayer':
      return maskKeepingLayer('U');
    case 'lastLayerCorners':
      return maskHidingLayerPieces('D', 'EDGES');
    case 'leftBlock':
      return maskByHome(shown, ({ home }) => (isLeftBlock(home) ? 'regular' : 'ignored'));
    case 'blocks':
      return maskByHome(shown, ({ home }) => (isBlock(home) ? 'regular' : 'ignored'));
    case 'blocksAndCorners':
      return maskByHome(shown, ({ orbit, home }) =>
        isBlock(home) || (orbit === 'CORNERS' && home.has('U')) ? 'regular' : 'ignored',
      );
    case 'cornerOrientation':
      // A piece's first sticker is the one that faces up or down when it is
      // home: for a top corner, its yellow.
      return maskByHome(shown, ({ orbit, home, facelet }) =>
        orbit === 'CORNERS' && home.has('U') && facelet === 0 ? 'regular' : 'ignored',
      );
    case 'lseOrientation':
      return maskByHome(shown, ({ orbit, home, facelet }) => {
        if (orbit === 'CENTERS') return home.has('U') || home.has('D') ? 'regular' : 'ignored';
        return orbit === 'EDGES' && !isBlock(home) && facelet === 0 ? 'regular' : 'ignored';
      });
  }
}
