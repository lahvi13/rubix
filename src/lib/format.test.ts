import { describe, expect, it } from 'vitest';
import {
  formatAxisMs,
  formatClock,
  formatInspection,
  formatIsoDate,
  formatMs,
  formatMsParts,
  formatTime,
  formatWhen,
} from './format';

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

describe('formatIsoDate', () => {
  it('pads to a sortable file-name date', () => {
    expect(formatIsoDate(new Date(2026, 0, 5, 23, 30).getTime())).toBe('2026-01-05');
    expect(formatIsoDate(new Date(2026, 11, 31, 0, 1).getTime())).toBe('2026-12-31');
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

describe('formatMsParts', () => {
  it.each([
    [0, '0', '00'],
    [1234, '1', '23'],
    [12999, '12', '99'],
    [61050, '1:01', '05'],
  ])('splits %i into %s and %s', (ms, seconds, hundredths) => {
    expect(formatMsParts(ms)).toEqual({ seconds, hundredths });
  });
});

describe('formatWhen', () => {
  const noon = new Date(2026, 8, 4, 12, 0).getTime();

  it('gives the clock alone for a solve from today', () => {
    const earlier = new Date(2026, 8, 4, 9, 5).getTime();
    expect(formatWhen(earlier, noon)).toBe(formatClock(earlier));
  });

  it('adds the day for a solve from another day', () => {
    const yesterday = new Date(2026, 8, 3, 22, 30).getTime();
    expect(formatWhen(yesterday, noon)).toContain(formatClock(yesterday));
    expect(formatWhen(yesterday, noon).length).toBeGreaterThan(formatClock(yesterday).length);
  });

  it('adds the year once the solve is from another one', () => {
    const lastYear = new Date(2025, 8, 4, 9, 5).getTime();
    expect(formatWhen(lastYear, noon)).toContain('2025');
  });
});

describe('formatAxisMs', () => {
  it.each<[number, number, string]>([
    // Under a minute the axis reads in seconds; a whole step keeps no decimal.
    [40_000, 55_000, '40'],
    [12_500, 20_000, '12.5'],
    [0, 20_000, '0'],
    // Once anything on the axis passes a minute, every tick is m:ss — this is
    // the mix the axes used to show: "40.00" next to "1:00.00".
    [40_000, 66_000, '0:40'],
    [60_000, 66_000, '1:00'],
    [66_000, 66_000, '1:06'],
    [125_000, 130_000, '2:05'],
  ])('formats %ims on an axis reaching %ims as %s', (ms, axisMaxMs, expected) => {
    expect(formatAxisMs(ms, axisMaxMs)).toBe(expected);
  });

  it('uses one shape for every tick of an axis', () => {
    const ticks = [40_000, 50_000, 60_000, 70_000];
    const shapes = ticks.map((tick) => formatAxisMs(tick, 70_000).includes(':'));
    expect(new Set(shapes).size).toBe(1);
  });
});
