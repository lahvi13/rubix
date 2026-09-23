import { describe, expect, it } from 'vitest';
import {
  formatAxisMs,
  formatBytes,
  formatClock,
  formatDate,
  formatDay,
  formatGoal,
  formatInspection,
  formatIsoDate,
  formatMs,
  formatMsParts,
  formatResult,
  formatRunning,
  formatRunningParts,
  formatTime,
  formatWhen,
} from './format';
import { penaltyLabel } from '../domain/solve/final-time';
import {
  INSPECTION_DNF_LIMIT_MS,
  INSPECTION_LIMIT_MS,
  penaltyForInspection,
} from '../domain/solve/penalty';

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
    expect(formatInspection(0, 15_000, 17_000)).toBe('15');
    expect(formatInspection(1, 15_000, 17_000)).toBe('15');
    expect(formatInspection(1000, 15_000, 17_000)).toBe('14');
    expect(formatInspection(14_500, 15_000, 17_000)).toBe('1');
  });

  it.each([
    [15_000, '+2'],
    [16_000, '+2'],
    [17_000, '+2'],
    [17_001, 'DNF'],
    [30_000, 'DNF'],
  ])('shows what starting at %i ms would cost: %s', (elapsedMs, shown) => {
    expect(formatInspection(elapsedMs, 15_000, 17_000)).toBe(shown);
  });

  it.each([15_500, 16_999, 17_000, 17_001, 20_000])(
    'agrees with the penalty the solve is given at %i ms',
    (elapsedMs) => {
      const shown = formatInspection(elapsedMs, INSPECTION_LIMIT_MS, INSPECTION_DNF_LIMIT_MS);
      expect(shown).toBe(penaltyLabel(penaltyForInspection(elapsedMs)));
    },
  );
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

describe('formatRunningParts', () => {
  it.each([
    [12_999, 'hundredths', '12', '99'],
    [12_999, 'tenths', '12', '9'],
    [12_999, 'seconds', '12', ''],
    [61_050, 'tenths', '1:01', '0'],
    [61_050, 'hidden', '1:01', ''],
    [0, 'tenths', '0', '0'],
  ] as const)('cuts %i shown as %s to %s and %j', (ms, display, seconds, fraction) => {
    expect(formatRunningParts(ms, display)).toEqual({ seconds, fraction });
  });
});

describe('formatRunning', () => {
  it.each([
    [12_999, 'hundredths', '12.99'],
    [12_999, 'tenths', '12.9'],
    [12_999, 'seconds', '12'],
    [12_999, 'hidden', null],
  ] as const)('writes %i shown as %s as %j', (ms, display, text) => {
    expect(formatRunning(ms, display)).toBe(text);
  });
});

describe('formatResult', () => {
  it.each([
    [12_340, 'none', '12.34'],
    [14_340, 'plus2', '14.34+'],
    [62_000, 'plus2', '1:02.00+'],
    [null, 'dnf', 'DNF'],
    // A DNF has no time to mark, whatever else the solve carried.
    [null, 'plus2', 'DNF'],
  ] as const)('%s with %s is %s', (ms, penalty, expected) => {
    expect(formatResult(ms, penalty)).toBe(expected);
  });
});

describe('formatDay', () => {
  const noon = new Date(2026, 8, 14, 12, 0).getTime();

  it.each([
    ['this morning', new Date(2026, 8, 14, 0, 5), 'Today'],
    ['late last night', new Date(2026, 8, 13, 23, 55), 'Yesterday'],
    ['the start of yesterday', new Date(2026, 8, 13, 0, 0), 'Yesterday'],
  ])('%s', (_, when, expected) => {
    expect(formatDay(when.getTime(), noon)).toBe(expected);
  });

  it('dates anything older', () => {
    const before = new Date(2026, 8, 12, 23, 59).getTime();
    expect(formatDay(before, noon)).toBe(formatDate(before));
  });

  it('counts yesterday across the start of a month', () => {
    const first = new Date(2026, 9, 1, 8, 0).getTime();
    expect(formatDay(new Date(2026, 8, 30, 20, 0).getTime(), first)).toBe('Yesterday');
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

describe('formatBytes', () => {
  it.each<[number, string]>([
    [0, '1 KB'],
    [300, '1 KB'],
    [52_000, '51 KB'],
    [1024 * 1024 - 1, '1.0 MB'],
    [1024 * 1024, '1.0 MB'],
    [2.44 * 1024 * 1024, '2.4 MB'],
    [14.6 * 1024 * 1024, '15 MB'],
    [3 * 1024 * 1024 * 1024, '3.0 GB'],
  ])('%i bytes read as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('formatGoal', () => {
  it.each<[number, string]>([
    [90_000, '1:30'],
    [45_000, '45'],
    [89_500, '1:29.50'],
    [20_250, '20.25'],
  ])('%i reads as %s', (ms, expected) => {
    expect(formatGoal(ms)).toBe(expected);
  });
});

describe('formatAxisMs', () => {
  it.each<[number, number, string]>([
    // Under a minute the axis reads in seconds; a whole step keeps no decimal.
    [40_000, 55_000, '40'],
    [12_500, 20_000, '12.5'],
    [1250, 2500, '1.25'],
    [1750, 2500, '1.75'],
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
