import { useEffect, useRef, useState } from 'react';
import type { TwistyPlayerElement } from '../../../types/twisty';
import { strings } from '../../../lib/strings';

interface CasePlayerProps {
  /** How the cube gets into the case: the algorithm, undone. */
  setupAlg: string;
  alg: string;
  visualization: '2D' | '3D';
  /** Bumped by the caller to replay the same algorithm again. */
  replayToken: number;
}

/**
 * The algorithm, running. This is the one place a twisty-player earns its
 * weight — a still picture is drawn far more cheaply by CubeDiagram, but
 * nothing else shows what the moves do to the cube.
 */
export function CasePlayer({ setupAlg, alg, visualization, replayToken }: CasePlayerProps) {
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
      visualization={visualization}
      background="none"
      control-panel="none"
      hint-facelets="none"
    />
  );
}
