import { useEffect, useState, type RefObject } from 'react';
import type { TwistyPlayerElement } from '../types/twisty';

/**
 * Plays the player from the start, but not before its cube is on screen, and
 * again whenever `playKey` changes. Says whether the cube is there, so the
 * still picture it replaces can stay under it until then.
 *
 * The player's clock starts the moment it is told to play, and the first time
 * round its 3D scene takes a while to build — three.js, the puzzle, a shader
 * to compile — and then fades in. Measured on a phone-speed CPU, the cube
 * first appeared a third of the way into the first move, which read as that
 * move being cut short.
 */
export function usePlayWhenDrawn(
  player: RefObject<TwistyPlayerElement | null>,
  isReady: boolean,
  playKey: string,
): boolean {
  const [isDrawn, setDrawn] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    const element = player.current;
    if (!element) return;
    element.jumpToStart();

    // Deprecated in cubing.js; a version without it plays straight away.
    if (typeof element.experimentalCurrentThreeJSPuzzleObject !== 'function') {
      setDrawn(true);
      return;
    }

    let cancelled = false;
    void element
      .experimentalCurrentThreeJSPuzzleObject()
      // The object exists before it has been rendered; two frames later it has,
      // and its canvas is fading in.
      .then(() => nextFrame())
      .then(() => nextFrame())
      .then(() => canvasFadeIn())
      .then(() => {
        if (!cancelled) setDrawn(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, player]);

  useEffect(() => {
    if (!isDrawn) return;
    const element = player.current;
    if (!element) return;
    element.jumpToStart();
    element.play();
  }, [isDrawn, player, playKey]);

  return isDrawn;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * cubing.js fades a new canvas in with a CSS animation of its own
 * (`.wrapper > canvas { animation: fade-in 0.25s }`). Its shadow roots are
 * closed, so the animation cannot be watched from out here — only waited out.
 * It starts when the canvas goes in, on the first frame the cube is rendered.
 */
const CANVAS_FADE_MS = 250;

function canvasFadeIn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, CANVAS_FADE_MS));
}
