import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STAY_AWAKE_MS, useStayAwake } from './use-stay-awake';

/** A wake lock that records what was asked of it. */
function fakeWakeLock() {
  const held: EventTarget[] = [];
  let requests = 0;
  const request = vi.fn(() => {
    requests += 1;
    const sentinel = new EventTarget();
    const lock = Object.assign(sentinel, {
      release: vi.fn(() => {
        held.splice(held.indexOf(sentinel), 1);
        sentinel.dispatchEvent(new Event('release'));
        return Promise.resolve();
      }),
    });
    held.push(sentinel);
    return Promise.resolve(lock);
  });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return {
    get held() {
      return held.length;
    },
    get requests() {
      return requests;
    },
    /** What the browser does to the lock when the page is hidden. */
    dropAll() {
      for (const sentinel of [...held]) {
        held.splice(held.indexOf(sentinel), 1);
        sentinel.dispatchEvent(new Event('release'));
      }
    },
  };
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets the lock's promise settle. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useStayAwake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('keeps the screen on while mounted, and lets it go when unmounted', async () => {
    const lock = fakeWakeLock();
    const { unmount } = renderHook(() => useStayAwake('idle'));
    await settle();
    expect(lock.held).toBe(1);

    unmount();
    await settle();
    expect(lock.held).toBe(0);
  });

  it('lets the screen sleep once the timer has not been used for a while', async () => {
    const lock = fakeWakeLock();
    const { rerender } = renderHook(({ activity }) => useStayAwake(activity), {
      initialProps: { activity: 'idle' },
    });
    await settle();

    act(() => vi.advanceTimersByTime(STAY_AWAKE_MS - 1));
    await settle();
    expect(lock.held).toBe(1);

    act(() => vi.advanceTimersByTime(1));
    await settle();
    expect(lock.held).toBe(0);

    // The next touch of the timer wakes it again.
    rerender({ activity: 'holding' });
    await settle();
    expect(lock.held).toBe(1);
  });

  it('starts the time over with every use', async () => {
    const lock = fakeWakeLock();
    const { rerender } = renderHook(({ activity }) => useStayAwake(activity), {
      initialProps: { activity: 'idle' },
    });
    await settle();

    act(() => vi.advanceTimersByTime(STAY_AWAKE_MS - 1000));
    rerender({ activity: 'running' });
    act(() => vi.advanceTimersByTime(STAY_AWAKE_MS - 1000));
    await settle();

    expect(lock.held).toBe(1);
    // One lock the whole time, not one per state of the clock.
    expect(lock.requests).toBe(1);
  });

  it('asks again when the page comes back, since hiding it dropped the lock', async () => {
    const lock = fakeWakeLock();
    renderHook(() => useStayAwake('idle'));
    await settle();

    setVisibility('hidden');
    lock.dropAll();
    await settle();
    expect(lock.held).toBe(0);

    setVisibility('visible');
    await settle();
    expect(lock.held).toBe(1);
  });

  it('does without where the browser has no wake lock', () => {
    expect(() => renderHook(() => useStayAwake('idle'))).not.toThrow();
  });
});
