import { useEffect, type RefObject } from 'react';
import type { TwistyCurrentMoveInfo, TwistyPlayerElement } from '../types/twisty';

/**
 * Reports which move of the algorithm the player is turning, and null when it
 * is between moves or has stopped.
 *
 * Listened to rather than timed: the player owns the tempo, and a clock of our
 * own would drift away from the cube on screen within a few turns.
 *
 * `onMove` has to keep its identity — a state setter does — or the listener is
 * torn down and rebuilt on every render.
 */
export function usePlayingMove(
  player: RefObject<TwistyPlayerElement | null>,
  isReady: boolean,
  onMove: (index: number | null) => void,
): void {
  useEffect(() => {
    if (!isReady) return;
    const element = player.current;
    if (!element) return;

    const listener = (info: TwistyCurrentMoveInfo) => {
      onMove(info.currentMoves.length > 0 ? info.patternIndex : null);
    };
    element.experimentalModel.currentMoveInfo.addFreshListener(listener);

    return () => {
      element.experimentalModel.currentMoveInfo.removeFreshListener(listener);
      onMove(null);
    };
  }, [isReady, player, onMove]);
}
