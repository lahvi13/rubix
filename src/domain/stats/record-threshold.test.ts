import { describe, expect, it } from 'vitest';
import { bestAverage } from './averages';
import { recordThreshold } from './record-threshold';

const fives = (ms: number) => [ms, ms, ms, ms, ms];

describe('recordThreshold', () => {
  it.each([
    ['fewer solves than the window', [10_000, 11_000, 12_000, 13_000], 5, null],
    ['every window a DNF', [null, null, 10_000, 11_000, 12_000], 5, null],
    ['a window size with nothing to trim from', fives(10_000), 1, null],
    // The best ao5 is 14 333 (two windows); the next result is the middle one
    // of three kept, so (11 000 + 12 000 + x) / 3 must round under it.
    [
      'the slowest result that still sets it, cut to hundredths',
      [...fives(20_000), 10_000, 11_000, 12_000, 30_000],
      5,
      { kind: 'below', belowMs: 19_990 },
    ],
    ['the rest of the window already equals the record', fives(10_000), 5, { kind: 'out-of-reach' }],
    [
      'a DNF in the window takes the trim, so the rest must carry it',
      [...fives(10_000), null, 10_000, 10_000, 10_000],
      5,
      { kind: 'out-of-reach' },
    ],
  ])('%s', (_, finals, n, expected) => {
    expect(recordThreshold(finals, n)).toEqual(expected);
  });

  it.each([
    ['ao5', [...fives(20_000), 10_000, 11_000, 12_000, 30_000], 5],
    // Twelve keeps ten: under 15 000 the next result is trimmed and the 15 000
    // counts; above it, it counts in its place.
    ['ao12', [...Array<number>(12).fill(30_000), 15_000, ...Array<number>(10).fill(20_000)], 12],
  ])('keeps its promise on the %s: under the cut-off sets the record, past it does not', (_, finals, n) => {
    const threshold = recordThreshold(finals, n);
    if (threshold?.kind !== 'below') throw new Error('expected a cut-off');
    const record = bestAverage(finals, n);
    const after = (next: number) => bestAverage([...finals, next], n);
    if (typeof record !== 'number') throw new Error('expected a record');
    // Every millisecond the clock still shows under the cut-off.
    for (let next = threshold.belowMs - 10; next < threshold.belowMs; next += 1) {
      expect(after(next)).toBeLessThan(record);
    }
    // The cut-off is no further from the true one than a hundredth.
    expect(after(threshold.belowMs + 10)).toBe(record);
  });

  it('places the ao12 cut-off where the trim puts it', () => {
    const finals = [...Array<number>(12).fill(30_000), 15_000, ...Array<number>(10).fill(20_000)];
    expect(recordThreshold(finals, 12)).toEqual({ kind: 'below', belowMs: 19_990 });
  });
});
