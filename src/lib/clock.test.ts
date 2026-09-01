import { describe, expect, it } from 'vitest';
import { now } from './clock';

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
