import { describe, expect, it } from 'vitest';
import { formatAlg, parseAlg, type Move } from '../cube/notation';
import { segmentAlg, triggerCoverage, type TriggerDefinition } from './triggers';

function moves(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`bad test alg: ${text}`);
  return parsed.moves;
}

function trigger(id: string, name: string, text: string): TriggerDefinition {
  return { id, name, moves: moves(text) };
}

const SEXY = trigger('sexy', 'Sexy move', "R U R' U'");
const SLEDGE = trigger('sledge', 'Sledgehammer', "R' F R F'");
const SUNE = trigger('sune', 'Sune', "R U R' U R U2 R'");
const INSERT = trigger('insert', 'Right insert', "R U R'");

/** Longest first, the order the repository hands them over in. */
const TRIGGERS = [SUNE, SEXY, SLEDGE, INSERT];

describe('segmentAlg', () => {
  it('names a trigger that fills the whole algorithm', () => {
    const segments = segmentAlg(moves("R U R' U'"), TRIGGERS);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.trigger?.name).toBe('Sexy move');
  });

  it('keeps the moves between triggers as loose moves', () => {
    const segments = segmentAlg(moves("U R U R' U' F"), TRIGGERS);

    expect(segments.map((segment) => segment.trigger?.name ?? null)).toEqual([
      null,
      'Sexy move',
      null,
    ]);
    expect(formatAlg(segments[0]?.moves ?? [])).toBe('U');
    expect(formatAlg(segments[2]?.moves ?? [])).toBe('F');
  });

  it('prefers the longer trigger where two of them start alike', () => {
    // Sune starts with a right insert; the reader should see the sune.
    const segments = segmentAlg(moves("R U R' U R U2 R'"), TRIGGERS);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.trigger?.name).toBe('Sune');
  });

  it('finds one trigger after another', () => {
    const segments = segmentAlg(moves("R U R' U' R' F R F'"), TRIGGERS);

    expect(segments.map((segment) => segment.trigger?.name)).toEqual([
      'Sexy move',
      'Sledgehammer',
    ]);
  });

  it('matches on the turn, not on how it was written', () => {
    const segments = segmentAlg(moves("r U R' U'"), TRIGGERS);

    // A wide turn is a different move, so this is not the sexy move.
    expect(segments[0]?.trigger).toBeNull();
  });

  it('leaves everything loose when no trigger is enabled', () => {
    const segments = segmentAlg(moves("R U R' U'"), []);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.trigger).toBeNull();
    expect(segments[0]?.moves).toHaveLength(4);
  });

  it('returns nothing for an empty algorithm', () => {
    expect(segmentAlg([], TRIGGERS)).toEqual([]);
  });
});

describe('triggerCoverage', () => {
  it.each<[string, string, number]>([
    ['all of it', "R U R' U'", 1],
    ['none of it', 'U D', 0],
    ['half of it', "R U R' U' U D", 4 / 6],
  ])('%s', (_name, text, expected) => {
    expect(triggerCoverage(segmentAlg(moves(text), TRIGGERS))).toBeCloseTo(expected);
  });

  it('is zero for an empty algorithm', () => {
    expect(triggerCoverage([])).toBe(0);
  });
});
