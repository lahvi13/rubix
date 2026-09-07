import { useEffect, useRef, useState } from 'react';
import type { TwistyPlayerElement } from '../../../types/twisty';
import { usePlayingMove } from '../../../hooks/use-playing-move';
import { strings } from '../../../lib/strings';
import { CAMERA_LATITUDE, CAMERA_LONGITUDE } from '../../../lib/twisty-camera';

interface CasePlayerProps {
  /** How the cube gets into the case: the algorithm, undone. */
  setupAlg: string;
  alg: string;
  /**
   * Which pieces matter, in cubing.js's own vocabulary ("PLL", "OLL", "F2L").
   * The player dims the rest, so the moving cube shows the same thing the
   * still picture does instead of a full-colour cube nobody has to read.
   */
  stickering: string;
  /** Bumped by the caller to replay the same algorithm again. */
  replayToken: number;
  /** Which move is turning, so the written algorithm can say where the cube is. */
  onMove: (index: number | null) => void;
}

/**
 * The algorithm, running. This is the one place a twisty-player earns its
 * weight — a still picture is drawn far more cheaply by CubeDiagram, but
 * nothing else shows what the moves do to the cube.
 */
export function CasePlayer({ setupAlg, alg, stickering, replayToken, onMove }: CasePlayerProps) {
  const player = useRef<TwistyPlayerElement | null>(null);
  const [isReady, setReady] = useState(false);

  // cubing/twisty is a heavy chunk and the trainer is usable without it, so it
  // is only fetched once someone actually asks to see a case move.
  useEffect(() => {
    let cancelled = false;
    void import('cubing/twisty').then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  usePlayingMove(player, isReady, onMove);

  useEffect(() => {
    if (!isReady) return;
    const element = player.current;
    if (!element) return;

    element.jumpToStart();
    element.play();
  }, [isReady, setupAlg, alg, replayToken]);

  if (!isReady) return <p className="case-player__loading">{strings.trainer.loadingPlayer}</p>;

  return (
    <twisty-player
      ref={player}
      className="case-player"
      puzzle="3x3x3"
      alg={alg}
      experimental-setup-alg={setupAlg}
      experimental-setup-anchor="start"
      experimental-stickering={stickering}
      visualization="3D"
      background="none"
      camera-latitude={CAMERA_LATITUDE}
      camera-longitude={CAMERA_LONGITUDE}
      control-panel="none"
      hint-facelets="none"
    />
  );
}
