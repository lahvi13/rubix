import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TwistyPlayerElement } from '../../../types/twisty';
import { usePlayWhenDrawn } from '../../../hooks/use-play-when-drawn';
import { usePlayingMove } from '../../../hooks/use-playing-move';
import { useTwistySkin } from '../../../hooks/use-twisty-skin';
import { strings } from '../../../lib/strings';
import { CAMERA_LATITUDE, CAMERA_LONGITUDE, CUBE_ORIENTATION } from '../../../lib/twisty-view';
import {
  maskHidingLayer,
  maskOrientingLayer,
  type StickeringMask,
} from '../../../lib/twisty-stickering';

/**
 * What the moving cube shows: everything; only the two layers a case is built
 * in, with the last layer greyed out the way the still picture greys it; or
 * only the last layer's yellow, the way an OLL picture reads.
 */
export type PlayerStickering = 'full' | 'firstTwoLayers' | 'orientation';

interface CasePlayerProps {
  /** How the cube gets into the case: the algorithm, undone. */
  setupAlg: string;
  alg: string;
  stickering: PlayerStickering;
  /** Bumped by the caller to replay the same algorithm again. */
  replayToken: number;
  /** Which move is turning, so the written algorithm can say where the cube is. */
  onMove: (index: number | null) => void;
  /**
   * The algorithm has been performed. The cube is solved by then — the case is
   * over — so the still picture of the case is what belongs on screen again.
   */
  onFinished: () => void;
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
  replayToken,
  onMove,
  onFinished,
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
    void Promise.all([import('cubing/twisty'), maskFor(stickering)]).then(([, nextMask]) => {
      if (cancelled) return;
      setMask(nextMask);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [stickering]);

  useEffect(() => {
    const element = player.current;
    if (!isReady || !element || mask === null) return;
    element.experimentalStickeringMaskOrbits = mask;
  }, [isReady, mask]);

  usePlayingMove(player, isReady, onMove, onFinished);
  useTwistySkin(player, isReady);
  const isDrawn = usePlayWhenDrawn(player, isReady, `${setupAlg}|${alg}|${replayToken}`);

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
        camera-longitude={CAMERA_LONGITUDE}
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
function maskFor(stickering: PlayerStickering): Promise<StickeringMask | null> {
  if (stickering === 'full') return Promise.resolve(null);
  return stickering === 'orientation' ? maskOrientingLayer('D') : maskHidingLayer('D');
}
