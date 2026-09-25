import { useEffect, useRef } from 'react';
import { isTypingTarget } from '../lib/typing-target';
import type { Playback } from './use-playback';

interface PlaybackKeysOptions {
  /** Whether the cube is on screen and the keys are its. */
  isActive: boolean;
  /**
   * Whether Space plays and pauses. Not where a timer is on screen: there
   * Space starts a solve, and it cannot mean two things.
   */
  withSpace: boolean;
}

/**
 * The buttons on a turning cube, on a keyboard: Space plays and pauses, the
 * arrows step a move back or on — the keys every video player has taught.
 * Only while the cube is up, played or paused; a still picture has nothing to
 * step through.
 *
 * Listened for in the capture phase, because an open sheet keeps every key to
 * itself (useKeyCapture) and the case detail is a sheet.
 */
export function usePlaybackKeys(playback: Playback, { isActive, withSpace }: PlaybackKeysOptions) {
  // Held in a ref: the playback's actions are new on every render, and the
  // listener should not be put up again for each.
  const latest = useRef(playback);
  useEffect(() => {
    latest.current = playback;
  });

  const isOn = isActive && playback.status !== 'idle';
  useEffect(() => {
    if (!isOn) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;
      const { status, position, toggle, step, back } = latest.current;

      if (event.code === 'Space' && withSpace) {
        event.preventDefault();
        // The button last clicked keeps the focus, and Space would click it
        // again as well — a step taken as the pause was asked for.
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
        toggle();
      } else if (event.key === 'ArrowRight') {
        if (status === 'paused' && position === 'end') return;
        event.preventDefault();
        step();
      } else if (event.key === 'ArrowLeft') {
        if (status !== 'paused' || position === 'start') return;
        event.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOn, withSpace]);
}
