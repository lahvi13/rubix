import { describe, expect, it } from 'vitest';
import {
  matchShadow,
  readShadowRecords,
  shadowSound,
  summariseShadow,
  type ShadowMatch,
  type ShadowRecord,
} from './shadow';

function record(splitMs: number[], voiceMs: number[], rawMs = 20_000, detector = 1): ShadowRecord {
  return { detector, splitMs, rawMs, voiceMs };
}

describe('matchShadow', () => {
  it.each<[string, ShadowRecord, ShadowMatch]>([
    [
      'nothing tapped, nothing said',
      record([], []),
      { boundaries: 0, heard: 0, extra: 0, offsetsMs: [] },
    ],
    [
      'every boundary heard, a little late',
      record([2000, 10_000, 14_000], [2040, 10_060, 14_030]),
      { boundaries: 3, heard: 3, extra: 0, offsetsMs: [40, 60, 30] },
    ],
    [
      'a voice before its tap counts too',
      record([2000], [1950]),
      { boundaries: 1, heard: 1, extra: 0, offsetsMs: [-50] },
    ],
    [
      'a boundary nobody spoke at is missed',
      record([2000, 10_000, 14_000], [2040, 14_030]),
      { boundaries: 3, heard: 2, extra: 0, offsetsMs: [40, 30] },
    ],
    [
      'a voice too far from any tap is extra, not a late hit',
      record([2000], [2600]),
      { boundaries: 1, heard: 0, extra: 1, offsetsMs: [] },
    ],
    [
      'one voice between two close taps goes to the nearer',
      record([2000, 2300], [2250]),
      { boundaries: 2, heard: 1, extra: 0, offsetsMs: [-50] },
    ],
    [
      'two voices at one tap: one hit, one extra',
      record([5000], [4900, 5020]),
      { boundaries: 1, heard: 1, extra: 1, offsetsMs: [20] },
    ],
    [
      'said at the stop, or after it, counts neither way',
      record([2000], [2010, 19_900, 20_300], 20_000),
      { boundaries: 1, heard: 1, extra: 0, offsetsMs: [10] },
    ],
    [
      'a solve finished early has only the boundaries it reached',
      record([3000], [3020, 7000], 9000),
      { boundaries: 1, heard: 1, extra: 1, offsetsMs: [20] },
    ],
  ])('%s', (_, input, expected) => {
    expect(matchShadow(input)).toEqual(expected);
  });
});

describe('summariseShadow', () => {
  it('has no offsets before anything is heard', () => {
    expect(summariseShadow([], 1)).toEqual({
      solves: 0,
      boundaries: 0,
      heard: 0,
      extra: 0,
      medianOffsetMs: null,
      spreadMs: null,
    });
  });

  it('adds solves up and reads the offsets together', () => {
    const summary = summariseShadow(
      [
        record([2000, 10_000, 14_000], [2040, 10_060, 14_030]),
        record([3000, 9000, 12_000], [3050, 12_020, 16_000]),
      ],
      1,
    );
    expect(summary).toMatchObject({ solves: 2, boundaries: 6, heard: 5, extra: 1 });
    // Offsets 40, 60, 30, 50, 20: the median is 40, the farthest 20 from it.
    expect(summary.medianOffsetMs).toBe(40);
    expect(summary.spreadMs).toBe(20);
  });

  it('leaves out what an older detector heard', () => {
    const summary = summariseShadow(
      [record([2000], [2040], 20_000, 1), record([2000], [], 20_000, 2)],
      2,
    );
    expect(summary).toMatchObject({ solves: 1, boundaries: 1, heard: 0 });
  });
});

describe('readShadowRecords', () => {
  it('keeps what it can read and drops the rest', () => {
    const good = record([2000], [2040]);
    expect(
      readShadowRecords([good, null, 'x', { ...good, voiceMs: ['a'] }, { ...good, rawMs: undefined }]),
    ).toEqual([good]);
  });

  it('keeps the sounds it can read, and the record without the ones it cannot', () => {
    const sound = shadowSound(2040.4, {
      verdict: 'voice',
      durationMs: 152,
      periodicity: 0.9345,
      pitchHz: 181.6,
      steadiness: 0.971,
      loudnessDb: 31.7,
    });
    expect(sound).toEqual({
      atMs: 2040,
      verdict: 'voice',
      durationMs: 152,
      periodicity: 0.93,
      pitchHz: 182,
      steadiness: 0.97,
      loudnessDb: 32,
    });
    const stored = { ...record([2000], [2040], 20_000, 2), sounds: [sound, { atMs: 'x' }] };
    expect(readShadowRecords([stored])).toEqual([{ ...stored, sounds: [sound] }]);
  });
});
