import { describe, expect, it } from 'vitest';
import type { Penalty } from '../../db/types';
import { drillRun, type RunAttempt } from './recent';

const DAY_START = 1_000_000;

function attempt(id: string, createdAt: number, rawMs: number, penalty: Penalty = 'none'): RunAttempt {
  return { id, createdAt, rawMs, penalty };
}

/** `count` attempts at one case, a second apart, ending at `end`. */
function series(prefix: string, end: number, times: readonly number[]): RunAttempt[] {
  return times.map((rawMs, index) => attempt(`${prefix}${index}`, end - (times.length - 1 - index) * 1000, rawMs));
}

describe('drillRun', () => {
  it('has nothing to say before the first attempt', () => {
    expect(drillRun(new Map(), DAY_START)).toEqual({ recent: [], todayCount: 0, todayMeanMs: null });
  });

  it('lists the newest attempts across every case, newest first', () => {
    const run = drillRun(
      new Map([
        ['t', [attempt('t1', DAY_START + 10, 2000), attempt('t2', DAY_START + 30, 2100)]],
        ['ua', [attempt('u1', DAY_START + 20, 1500)]],
      ]),
      DAY_START,
    );
    expect(run.recent.map((entry) => entry.id)).toEqual(['t2', 'u1', 't1']);
  });

  it('keeps to the limit', () => {
    const attempts = series('t', DAY_START + 100_000, [1, 2, 3, 4, 5, 6, 7].map((n) => n * 1000));
    expect(drillRun(new Map([['t', attempts]]), DAY_START, 5).recent).toHaveLength(5);
  });

  it.each([
    // The five before it average 3.00; 2.50 is half a second under.
    { times: [3000, 3000, 3000, 3000, 3000, 2500], versus: -500 },
    { times: [3000, 3000, 3000, 3000, 3000, 3400], versus: 400 },
    // The ao5 trims its best and worst, as every ao5 in the app does.
    { times: [1000, 3000, 3000, 3000, 9000, 3000], versus: 0 },
    // Only four before it: no ao5 to measure against.
    { times: [3000, 3000, 3000, 3000, 2500], versus: null },
  ])('measures $times against the ao5 before the last', ({ times, versus }) => {
    const run = drillRun(new Map([['t', series('t', DAY_START + 100_000, times)]]), DAY_START, 1);
    expect(run.recent[0]?.versusAo5Ms).toBe(versus);
  });

  it('says no gap for a DNF, on either side', () => {
    const dnfNow = [...series('a', DAY_START + 10_000, [3000, 3000, 3000, 3000, 3000]), attempt('a5', DAY_START + 20_000, 2000, 'dnf')];
    const dnfBefore = [
      attempt('b0', DAY_START + 1000, 3000, 'dnf'),
      attempt('b1', DAY_START + 2000, 3000, 'dnf'),
      ...series('b', DAY_START + 10_000, [3000, 3000, 3000]),
      attempt('b5', DAY_START + 20_000, 2000),
    ];
    const run = drillRun(new Map([['a', dnfNow], ['b', dnfBefore]]), DAY_START, 2);
    expect(run.recent.map((entry) => [entry.id, entry.finalMs, entry.versusAo5Ms])).toEqual([
      ['a5', null, null],
      ['b5', 2000, null],
    ]);
  });

  it('counts today from the start of the day and means it as the session mean does', () => {
    const run = drillRun(
      new Map([
        [
          't',
          [
            attempt('old', DAY_START - 1, 9000),
            attempt('a', DAY_START, 2000),
            attempt('b', DAY_START + 10, 4000),
            attempt('c', DAY_START + 20, 1000, 'dnf'),
          ],
        ],
      ]),
      DAY_START,
    );
    expect(run.todayCount).toBe(3);
    // The DNF counts as an attempt and is left out of the mean.
    expect(run.todayMeanMs).toBe(3000);
  });
});
