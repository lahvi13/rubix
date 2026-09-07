import { describe, expect, it } from 'vitest';
import { timeAxis, timeStep } from './axis';

describe('timeStep', () => {
  it.each([
    [0, 1000, 250],
    [0, 4000, 1000],
    [0, 12_000, 5000],
    [0, 45_000, 10_000],
    [0, 100_000, 30_000],
    [0, 200_000, 60_000],
  ])('picks a readable step for %i..%ims', (minMs, maxMs, expected) => {
    expect(timeStep(minMs, maxMs)).toBe(expected);
  });

  it('never falls off the end of the ladder', () => {
    expect(timeStep(0, 10 ** 9)).toBe(600_000);
  });

  it('takes a coarser step when fewer gaps are asked for', () => {
    expect(timeStep(0, 12_000, 2)).toBe(10_000);
  });

  it('counts the gaps it will actually draw, not the raw range', () => {
    // 0..1:00.4 is barely over one minute; counting the raw range would call
    // that "one gap of 60s" and then draw two, to 2:00.
    expect(timeStep(0, 60_400, 5)).toBe(15_000);
  });
});

describe('timeAxis', () => {
  it('rounds both ends out to whole steps', () => {
    // The complaint that started this: 1:00.00 .. 1:06.00 used to tick by 1.5s.
    const axis = timeAxis(60_000, 66_000);
    expect(axis.ticksMs).toEqual([60_000, 62_000, 64_000, 66_000]);
    expect(axis.domainMs).toEqual([60_000, 66_000]);
  });

  it('starts and ends on a tick', () => {
    const axis = timeAxis(61_300, 65_800);
    expect(axis.ticksMs[0]).toBe(axis.domainMs[0]);
    expect(axis.ticksMs[axis.ticksMs.length - 1]).toBe(axis.domainMs[1]);
  });

  it('steps evenly', () => {
    const { ticksMs } = timeAxis(9500, 31_000);
    const gaps = ticksMs.slice(1).map((tick, index) => tick - (ticksMs[index] ?? 0));
    expect(new Set(gaps).size).toBe(1);
  });

  it('never draws more gaps than it was asked for', () => {
    for (const maxMs of [6000, 21_000, 60_400, 120_400, 305_000]) {
      expect(timeAxis(0, maxMs).ticksMs.length - 1).toBeLessThanOrEqual(5);
    }
  });

  it('does not leave half the chart empty above a lone slow solve', () => {
    // A 2:00.4 solve used to push the top of the axis to 3:00.
    expect(timeAxis(0, 120_400).domainMs[1]).toBe(150_000);
  });

  it('widens a flat range so the line is not drawn on the edge', () => {
    const axis = timeAxis(12_000, 12_000);
    expect(axis.domainMs[0]).toBeLessThan(12_000);
    expect(axis.domainMs[1]).toBeGreaterThan(12_000);
  });
});
