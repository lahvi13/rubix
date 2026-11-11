import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToday } from './use-today';

describe('useToday', () => {
  beforeEach(() => {
    // Half a minute to midnight, on the reader's own clock.
    vi.useFakeTimers({ now: new Date(2031, 2, 14, 23, 59, 30) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says what day it is', () => {
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2031-03-14');
  });

  it('turns with the day, and with the one after it', () => {
    const { result } = renderHook(() => useToday());

    act(() => vi.advanceTimersByTime(29_000));
    expect(result.current).toBe('2031-03-14');

    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current).toBe('2031-03-15');

    // Armed again for the next midnight, not only for the first.
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    expect(result.current).toBe('2031-03-16');
  });

  it('notices a midnight that passed while the page was put away', () => {
    // Months on from the tests above: the app's clock never runs backwards,
    // and it has been through their midnights already.
    vi.setSystemTime(new Date(2031, 5, 1, 22, 0, 0));
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2031-06-01');

    // A phone runs no timer for a hidden page: the clock moves, the timer does not.
    vi.setSystemTime(new Date(2031, 5, 2, 7, 0, 0));
    expect(result.current).toBe('2031-06-01');

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('2031-06-02');
  });

  it('stops watching once nothing reads it', () => {
    const { unmount } = renderHook(() => useToday());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
