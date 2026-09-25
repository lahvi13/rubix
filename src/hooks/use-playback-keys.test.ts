import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Playback, PlaybackPosition, PlaybackStatus } from './use-playback';
import { usePlaybackKeys } from './use-playback-keys';

function playback(status: PlaybackStatus, position: PlaybackPosition = 'middle'): Playback {
  return {
    status,
    position,
    request: { kind: 'start', id: 1 },
    toggle: vi.fn(),
    step: vi.fn(),
    back: vi.fn(),
    restart: vi.fn(),
    stop: vi.fn(),
    stopped: vi.fn(),
  };
}

function press(init: KeyboardEventInit, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('usePlaybackKeys', () => {
  it('plays and pauses on Space, and keeps the page from scrolling', () => {
    const cube = playback('playing');
    renderHook(() => usePlaybackKeys(cube, { isActive: true, withSpace: true }));
    expect(press({ code: 'Space', key: ' ' }).defaultPrevented).toBe(true);
    expect(cube.toggle).toHaveBeenCalledOnce();
  });

  it('leaves Space alone where a timer owns it', () => {
    const cube = playback('paused');
    renderHook(() => usePlaybackKeys(cube, { isActive: true, withSpace: false }));
    expect(press({ code: 'Space', key: ' ' }).defaultPrevented).toBe(false);
    expect(cube.toggle).not.toHaveBeenCalled();
    press({ key: 'ArrowRight' });
    expect(cube.step).toHaveBeenCalledOnce();
  });

  it.each<[PlaybackStatus, PlaybackPosition, 'ArrowLeft' | 'ArrowRight', 'step' | 'back' | null]>([
    ['paused', 'middle', 'ArrowRight', 'step'],
    ['paused', 'middle', 'ArrowLeft', 'back'],
    ['paused', 'end', 'ArrowRight', null],
    ['paused', 'start', 'ArrowLeft', null],
    // Playing, a step on is a pause at the end of this move; there is no back.
    ['playing', 'middle', 'ArrowRight', 'step'],
    ['playing', 'middle', 'ArrowLeft', null],
  ])('%s at the %s: %s steps %s', (status, position, key, action) => {
    const cube = playback(status, position);
    renderHook(() => usePlaybackKeys(cube, { isActive: true, withSpace: true }));
    const event = press({ key });
    expect(cube.step).toHaveBeenCalledTimes(action === 'step' ? 1 : 0);
    expect(cube.back).toHaveBeenCalledTimes(action === 'back' ? 1 : 0);
    // An arrow with nothing to do is the page's to scroll with.
    expect(event.defaultPrevented).toBe(action !== null);
  });

  it.each<[string, Playback, boolean]>([
    ['a still picture', playback('idle'), true],
    ['a cube that is not on screen', playback('paused'), false],
  ])('does nothing for %s', (_, cube, isActive) => {
    renderHook(() => usePlaybackKeys(cube, { isActive, withSpace: true }));
    press({ code: 'Space', key: ' ' });
    press({ key: 'ArrowRight' });
    expect(cube.toggle).not.toHaveBeenCalled();
    expect(cube.step).not.toHaveBeenCalled();
  });

  it('keeps out of a text field', () => {
    const cube = playback('paused');
    renderHook(() => usePlaybackKeys(cube, { isActive: true, withSpace: true }));
    const field = document.body.appendChild(document.createElement('textarea'));
    press({ code: 'Space', key: ' ' }, field);
    press({ key: 'ArrowLeft' }, field);
    expect(cube.toggle).not.toHaveBeenCalled();
    expect(cube.back).not.toHaveBeenCalled();
    field.remove();
  });
});
