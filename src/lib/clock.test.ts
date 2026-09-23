import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventTime, now } from './clock';

describe('now', () => {
  it('is strictly increasing, so createdAt can be used as a sort key', () => {
    const stamps = Array.from({ length: 1000 }, () => now());
    const sorted = [...stamps].sort((a, b) => a - b);

    expect(stamps).toEqual(sorted);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it('stays within a hair of the real clock', () => {
    const drift = Math.abs(now() - Date.now());
    expect(drift).toBeLessThan(1000);
  });
});

describe('eventTime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['a stamp on the same clock, from a busy frame ago', 9_960, 9_960],
    ['a stamp from the future', 10_050, 10_000],
    ['an epoch stamp', 1_790_000_000_000, 10_000],
    ['no stamp at all', 0, 10_000],
    ['a stamp too old to be this event', 8_000, 10_000],
  ])('takes %s as %i -> %i', (_name, timeStamp, expected) => {
    vi.spyOn(performance, 'now').mockReturnValue(10_000);
    expect(eventTime(timeStamp)).toBe(expected);
  });
});
