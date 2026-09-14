import { describe, expect, it } from 'vitest';
import { formatMs } from '../../lib/format';
import { parseTimeInput } from './parse-time';

describe('parseTimeInput', () => {
  it.each<[string, number]>([
    ['12.34', 12_340],
    ['12,34', 12_340],
    ['12', 12_000],
    ['1:23.45', 83_450],
    ['1:23', 83_000],
    ['0.5', 500],
    ['1.005', 1005],
    ['125.32', 125_320],
    ['10:00', 600_000],
    ['  9.99  ', 9990],
    // A phone's number pad has no colon; a space or a dash stands in for it.
    ['1 30', 90_000],
    ['1-23.45', 83_450],
    ['1 - 23,45', 83_450],
  ])('reads %s as %ims', (input, expected) => {
    expect(parseTimeInput(input)).toBe(expected);
  });

  it.each(['', 'abc', '1:99.00', '12.3456', '-5', '0', '0.000', '1:2:3', '1..2', '12.', '1 99', '1 2 3', '1-', '- 5'])(
    'rejects %s',
    (input) => {
      expect(parseTimeInput(input)).toBeNull();
    },
  );

  it('round-trips whatever the app displays', () => {
    for (const ms of [990, 12_340, 83_450, 599_990]) {
      expect(parseTimeInput(formatMs(ms))).toBe(ms);
    }
  });
});
