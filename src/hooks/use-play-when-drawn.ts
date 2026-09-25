import { useEffect, useState, type RefObject } from 'react';
import type { PlaybackRequest } from './use-playback';
import type { TwistyPlayerElement } from '../types/twisty';

/**
 * Carries out what the player was last asked to do, but not before its cube
 * is on screen. Says whether the cube is there, so the still picture it
 * replaces can stay under it until then.
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
  request: PlaybackRequest,
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
    perform(element, request.kind);
  }, [isDrawn, player, request]);

  return isDrawn;
}

function perform(element: TwistyPlayerElement, kind: PlaybackRequest['kind']): void {
  switch (kind) {
    case 'start':
      element.jumpToStart();
      element.play();
      return;
    case 'startStep':
      element.jumpToStart();
      untilMoveEnds(element);
      return;
    case 'resume':
      element.play();
      return;
    case 'pause':
    case 'step':
      untilMoveEnds(element);
  }
}

/**
 * Plays to the end of the move that is turning, or through the next one when
 * the cube is at rest. A pause that froze the cube wherever it was would leave
 * a layer standing at an angle, which is no position a cube in the hand is
 * ever in — and the move it stopped in would be neither done nor undone.
 *
 * Never from the end back round to the start: a pause asked for just as the
 * last move finished would otherwise play the algorithm's first move.
 */
function untilMoveEnds(element: TwistyPlayerElement): void {
  element.controller.animationController.play({
    untilBoundary: 'move',
    autoSkipToOtherEndIfStartingAtBoundary: false,
  });
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
