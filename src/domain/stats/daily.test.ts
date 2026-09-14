import { describe, expect, it } from 'vitest';
import {
  calendarDays,
  dayKeyOf,
  dayNumber,
  practiceStreak,
  summariseDays,
  type DayEntry,
  type DaySummary,
} from './daily';

describe('summariseDays', () => {
  it.each<[string, DayEntry[], DaySummary[]]>([
    ['has no days without solves', [], []],
    [
      'gives each day its count, mean and best',
      [
        { dayKey: '2026-09-13', finalMs: 10_000 },
        { dayKey: '2026-09-13', finalMs: 12_000 },
        { dayKey: '2026-09-14', finalMs: 9000 },
      ],
      [
        { dayKey: '2026-09-13', count: 2, meanMs: 11_000, bestMs: 10_000 },
        { dayKey: '2026-09-14', count: 1, meanMs: 9000, bestMs: 9000 },
      ],
    ],
    [
      'counts a DNF but leaves it out of the times',
      [
        { dayKey: '2026-09-13', finalMs: null },
        { dayKey: '2026-09-13', finalMs: 12_000 },
      ],
      [{ dayKey: '2026-09-13', count: 2, meanMs: 12_000, bestMs: 12_000 }],
    ],
    [
      'has no times on a day of DNFs',
      [{ dayKey: '2026-09-13', finalMs: null }],
      [{ dayKey: '2026-09-13', count: 1, meanMs: null, bestMs: null }],
    ],
  ])('%s', (_name, entries, expected) => {
    expect(summariseDays(entries)).toEqual(expected);
  });
});

describe('dayNumber', () => {
  it('counts calendar days, across a month and a clock change', () => {
    expect(dayNumber('2026-11-01') - dayNumber('2026-10-24')).toBe(8);
    expect(dayNumber('2026-03-01') - dayNumber('2026-02-28')).toBe(1);
  });

  it.each(['2026-09-14', '2024-02-29', '2027-01-01'])('turns %s back into itself', (key) => {
    expect(dayKeyOf(dayNumber(key))).toBe(key);
  });
});

describe('calendarDays', () => {
  it('lists the days up to the last one, oldest first, over a month end', () => {
    expect(calendarDays('2026-10-02', 4)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });
});

describe('practiceStreak', () => {
  const practised = new Set(['2026-09-10', '2026-09-12', '2026-09-13', '2026-09-14']);

  it.each<[string, string, number]>([
    ['counts the run that ends today', '2026-09-14', 3],
    ['keeps yesterday’s run alive before today’s first solve', '2026-09-15', 3],
    ['is broken by a whole day missed', '2026-09-16', 0],
    ['stops at the first gap', '2026-09-10', 1],
  ])('%s', (_name, today, expected) => {
    expect(practiceStreak(practised, today)).toBe(expected);
  });

  it('is nothing without practice', () => {
    expect(practiceStreak(new Set(), '2026-09-14')).toBe(0);
  });
});
