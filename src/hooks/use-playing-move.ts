import { useEffect, type RefObject } from 'react';
import type { TwistyCurrentMoveInfo, TwistyPlayerElement } from '../types/twisty';

/**
 * Reports which move of the algorithm the player is turning, and null when
 * nothing is.
 *
 * Listened to rather than timed: the player owns the tempo, and a clock of our
 * own would drift away from the cube on screen within a few turns.
 *
 * Whether it is playing at all has to be asked separately. The last move of an
 * algorithm stays the current move once the animation stops, so without this
 * the cube would come to rest with a move still lit.
 *
 * `onMove` has to keep its identity — a state setter does — or the listeners
 * are torn down and rebuilt on every render.
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

    let isPlaying = false;

    const onMoveInfo = (info: TwistyCurrentMoveInfo) => {
      onMove(isPlaying && info.currentMoves.length > 0 ? info.patternIndex : null);
    };
    const onPlayingInfo = (info: { playing: boolean }) => {
      isPlaying = info.playing;
      if (!isPlaying) onMove(null);
    };

    const model = element.experimentalModel;
    model.playingInfo.addFreshListener(onPlayingInfo);
    model.currentMoveInfo.addFreshListener(onMoveInfo);

    return () => {
      model.playingInfo.removeFreshListener(onPlayingInfo);
      model.currentMoveInfo.removeFreshListener(onMoveInfo);
      onMove(null);
    };
  }, [isReady, player, onMove]);
}
