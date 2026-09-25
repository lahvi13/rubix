import { useCallback, useState } from 'react';

/**
 * What a turning cube is doing, as far as its buttons are concerned. Idle is
 * "the next play starts from the beginning": no cube on screen yet, or one
 * that has been played to the end.
 */
export type PlaybackStatus = 'idle' | 'playing' | 'paused';

/** Where a cube at rest stands in its algorithm. */
export type PlaybackPosition = 'start' | 'middle' | 'end';

/**
 * What the player is asked to do next. The id makes asking twice two
 * requests, and lets a player that is still being built carry out whatever
 * was asked last once its cube is on screen.
 */
export interface PlaybackRequest {
  kind: 'start' | 'startStep' | 'resume' | 'pause' | 'step' | 'back';
  id: number;
}

export interface Playback {
  status: PlaybackStatus;
  /** Where a paused cube stands: nothing to step back to at the start, nor on at the end. */
  position: PlaybackPosition;
  request: PlaybackRequest;
  /** Play from the beginning if idle, go on from the pause if paused. */
  toggle: () => void;
  /** One move and stop; while playing, stop at the end of this one. */
  step: () => void;
  /** One move back, while paused. */
  back: () => void;
  /** From the beginning, whatever it was doing. */
  restart: () => void;
  /** Back to idle. */
  stop: () => void;
  /**
   * The player has come to rest, and where. Kept stable: the player
   * subscribes to it.
   */
  stopped: (at: PlaybackPosition) => void;
}

interface State {
  key: string;
  status: PlaybackStatus;
  position: PlaybackPosition;
  request: PlaybackRequest;
}

/**
 * Play, pause and step for one turning cube. The buttons and a tap on the
 * cube ask here; the player carries it out (see usePlayWhenDrawn) and says
 * where it stopped (see usePlayingMove).
 *
 * Played to the end, the cube is done and the playback is idle again. Stepped
 * to the end, it stays paused there: whoever is going a move at a time may
 * well want the last one again, and a cube that vanished on the last step
 * would leave them nothing to step back through.
 *
 * `resetKey` is what the cube is showing — a scramble, a question. When it
 * changes the playback is idle again, without anything having to remember to
 * stop it.
 */
export function usePlayback(resetKey = ''): Playback {
  const [state, setState] = useState<State>({
    key: resetKey,
    status: 'idle',
    position: 'start',
    request: { kind: 'start', id: 0 },
  });
  const status = state.key === resetKey ? state.status : 'idle';

  const ask = (kind: PlaybackRequest['kind'], next: PlaybackStatus): void => {
    setState((current) => ({
      key: resetKey,
      status: next,
      position: 'middle',
      request: { kind, id: current.request.id + 1 },
    }));
  };

  const toggle = (): void => {
    if (status === 'playing') ask('pause', 'paused');
    // Paused at either end there is nothing to go on with: play it through.
    else ask(status === 'paused' && state.position === 'middle' ? 'resume' : 'start', 'playing');
  };
  const step = (): void => {
    if (status === 'idle') ask('startStep', 'paused');
    // While it plays, a step is a pause: the move that is turning is the step.
    else ask(status === 'playing' ? 'pause' : 'step', 'paused');
  };
  const back = (): void => {
    if (status === 'paused') ask('back', 'paused');
  };
  const restart = (): void => ask('start', 'playing');
  const stop = (): void => setState((current) => ({ ...current, status: 'idle' }));
  const stopped = useCallback(
    (at: PlaybackPosition) =>
      setState((current) =>
        at === 'end' && current.status === 'playing'
          ? { ...current, status: 'idle', position: at }
          : { ...current, position: at },
      ),
    [],
  );

  return {
    status,
    position: state.position,
    request: state.request,
    toggle,
    step,
    back,
    restart,
    stop,
    stopped,
  };
}
