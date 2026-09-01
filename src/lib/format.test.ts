import { describe, expect, it } from 'vitest';
import { formatInspection, formatMs, formatTime } from './format';

describe('formatMs', () => {
  it.each<[number, string]>([
    [0, '0.00'],
    [90, '0.09'],
    [1234, '1.23'],
    // Truncated, not rounded: the timer must not claim a time never reached.
    [12_999, '12.99'],
    [59_990, '59.99'],
    [60_000, '1:00.00'],
    [83_450, '1:23.45'],
    [3_600_000, '60:00.00'],
  ])('%ims renders as %s', (ms, expected) => {
    expect(formatMs(ms)).toBe(expected);
  });
});

describe('formatTime', () => {
  it('renders DNF for a null result', () => {
    expect(formatTime(null)).toBe('DNF');
    expect(formatTime(1234)).toBe('1.23');
  });
});

describe('formatInspection', () => {
  it('counts down in whole seconds', () => {
    expect(formatInspection(0, 15_000)).toBe('15');
    expect(formatInspection(1, 15_000)).toBe('15');
    expect(formatInspection(1000, 15_000)).toBe('14');
    expect(formatInspection(14_500, 15_000)).toBe('1');
  });

  it('shows the penalty once the limit is gone', () => {
    expect(formatInspection(15_000, 15_000)).toBe('+2');
    expect(formatInspection(16_000, 15_000)).toBe('+2');
  });
});
