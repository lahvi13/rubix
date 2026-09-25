import { useCallback, useState } from 'react';

/**
 * What a turning cube is doing, as far as its buttons are concerned. Idle is
 * "the next play starts from the beginning": no cube on screen yet, or one
 * that has been played to the end.
 */
export type PlaybackStatus = 'idle' | 'playing' | 'paused';

/**
 * What the player is asked to do next. The id makes asking twice two
 * requests, and lets a player that is still being built carry out whatever
 * was asked last once its cube is on screen.
 */
export interface PlaybackRequest {
  kind: 'start' | 'startStep' | 'resume' | 'pause' | 'step';
  id: number;
}

export interface Playback {
  status: PlaybackStatus;
  request: PlaybackRequest;
  /** Play from the beginning if idle, go on from the pause if paused. */
  toggle: () => void;
  /** One move and stop; while playing, stop at the end of this one. */
  step: () => void;
  /** From the beginning, whatever it was doing. */
  restart: () => void;
  /**
   * Back to idle. Kept stable: it is also what a player calls when it gets to
   * the end, and the player subscribes to it.
   */
  stop: () => void;
}

interface State {
  key: string;
  status: PlaybackStatus;
  request: PlaybackRequest;
}

/**
 * Play, pause and step for one turning cube. The buttons and a tap on the
 * cube ask here; the player carries it out (see usePlayWhenDrawn).
 *
 * `resetKey` is what the cube is showing — a scramble, a question. When it
 * changes the playback is idle again, without anything having to remember to
 * stop it.
 */
export function usePlayback(resetKey = ''): Playback {
  const [state, setState] = useState<State>({
    key: resetKey,
    status: 'idle',
    request: { kind: 'start', id: 0 },
  });
  const status = state.key === resetKey ? state.status : 'idle';

  const ask = (kind: PlaybackRequest['kind'], next: PlaybackStatus): void => {
    setState((current) => ({
      key: resetKey,
      status: next,
      request: { kind, id: current.request.id + 1 },
    }));
  };

  const toggle = (): void => {
    if (status === 'playing') ask('pause', 'paused');
    else ask(status === 'paused' ? 'resume' : 'start', 'playing');
  };
  const step = (): void => {
    if (status === 'idle') ask('startStep', 'paused');
    // While it plays, a step is a pause: the move that is turning is the step.
    else ask(status === 'playing' ? 'pause' : 'step', 'paused');
  };
  const restart = (): void => ask('start', 'playing');
  const stop = useCallback(() => setState((current) => ({ ...current, status: 'idle' })), []);

  return { status, request: state.request, toggle, step, restart, stop };
}
