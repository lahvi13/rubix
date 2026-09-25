import { useEffect, type RefObject } from 'react';
import type { PlaybackPosition } from './use-playback';
import type {
  TwistyCurrentMoveInfo,
  TwistyPlayerElement,
  TwistyTimelineInfo,
} from '../types/twisty';

/**
 * Reports which move of the algorithm the player is turning, and null when
 * nothing is. At rest, it is the move the cube stopped after: that is the
 * place the reader is keeping, and the one the cube on screen has just done.
 * `onStopped`, if given, says the player has come to rest, and where.
 *
 * Listened to rather than timed: the player owns the tempo, and a clock of our
 * own would drift away from the cube on screen within a few turns.
 *
 * Whether it is playing at all has to be asked separately. The last move of an
 * algorithm stays the current move once the animation stops, so without this
 * the cube would come to rest with a move still lit. And a stop is only the
 * end when the player stands at the end — anywhere else it is a pause, or a
 * step back to the start.
 *
 * The callbacks have to keep their identity — a state setter does, and
 * anything else wants `useCallback` — or the listeners are torn down and
 * rebuilt on every render.
 */
export function usePlayingMove(
  player: RefObject<TwistyPlayerElement | null>,
  isReady: boolean,
  onMove: (index: number | null) => void,
  onStopped?: (at: PlaybackPosition) => void,
): void {
  useEffect(() => {
    if (!isReady) return;
    const element = player.current;
    if (!element) return;

    let timeline: TwistyTimelineInfo = { playing: false, atStart: true, atEnd: false };
    let move: TwistyCurrentMoveInfo | null = null;
    // The player says it is not playing before it starts, too. Only the stop
    // that follows a start is one to report.
    let hasPlayed = false;

    const report = () => {
      if (move === null) return;
      if (timeline.playing) onMove(move.currentMoves.length > 0 ? move.patternIndex : null);
      else onMove(hasPlayed && !timeline.atStart ? move.patternIndex : null);
    };
    const onMoveInfo = (info: TwistyCurrentMoveInfo) => {
      move = info;
      report();
    };
    const onTimeline = (info: TwistyTimelineInfo) => {
      timeline = info;
      if (info.playing) hasPlayed = true;
      report();
      if (info.playing || !hasPlayed) return;
      onStopped?.(info.atStart ? 'start' : info.atEnd ? 'end' : 'middle');
    };

    const model = element.experimentalModel;
    model.coarseTimelineInfo.addFreshListener(onTimeline);
    model.currentMoveInfo.addFreshListener(onMoveInfo);

    return () => {
      model.coarseTimelineInfo.removeFreshListener(onTimeline);
      model.currentMoveInfo.removeFreshListener(onMoveInfo);
      onMove(null);
    };
  }, [isReady, player, onMove, onStopped]);
}
