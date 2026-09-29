import { describe, expect, it } from 'vitest';
import { SPLITS_SCHEMA_VERSION, type Solve } from '../../db/types';
import { parseAlg } from '../../domain/cube/notation';
import { applyAlg, solvedState } from '../../domain/cube/state';
import { solveCard, solveCardFilename, type SolveRecord } from './solve-card';

function solve(overrides: Partial<Solve> = {}): Solve {
  return {
    id: 's',
    sessionId: 'session',
    puzzle: '333',
    mode: 'freestyle',
    caseId: null,
    scramble: "R U R' U' F2",
    scrambleSource: 'generated',
    rawMs: 12_345,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: 0,
    splits: [],
    splitsSchemaVersion: SPLITS_SCHEMA_VERSION,
    tagIds: [],
    note: null,
    starred: 0,
    editedAt: null,
    createdAt: Date.UTC(2026, 8, 23, 12),
    updatedAt: 0,
    ...overrides,
  };
}

describe('solveCard', () => {
  it.each<[string, Partial<Solve>, string]>([
    ['a clean time', {}, '12.34'],
    ['a +2, with the two added and marked', { penalty: 'plus2' }, '14.34+'],
    ['a DNF', { penalty: 'dnf' }, 'DNF'],
  ])('writes %s as the app does', (_name, overrides, headline) => {
    expect(solveCard(solve(overrides), null).headline).toBe(headline);
  });

  it.each<[SolveRecord, string | null]>([
    ['personal', '★ Personal best'],
    ['session', '★ Best of this session'],
    [null, null],
  ])('carries the record it holds: %s', (record, badge) => {
    expect(solveCard(solve(), record).badge).toBe(badge);
  });

  it.each<[Solve['scrambleSource'], string]>([
    ['generated', 'Single'],
    ['own', 'Single · Your own scramble'],
    ['history', 'Single · Scramble from the history'],
    ['shared', 'Single · Shared scramble'],
  ])('says up top when the scramble was not drawn by the app: %s', (scrambleSource, kicker) => {
    expect(solveCard(solve({ scrambleSource }), null).kicker).toBe(kicker);
  });

  it('shows the scramble it was timed on', () => {
    expect(solveCard(solve(), null).detail).toBe("R U R' U' F2");
  });

  it('draws the cube the scramble makes', () => {
    const parsed = parseAlg("R U R' U' F2");
    const expected = parsed.ok ? applyAlg(solvedState(), parsed.moves) : null;
    expect(solveCard(solve(), null).cube).toEqual(expected);
  });

  it.each<[string, Partial<Solve>]>([
    ['another puzzle', { puzzle: '222' }],
    ['a scramble that does not read', { scramble: 'R Q' }],
    ['no scramble at all', { scramble: '' }],
  ])('draws no cube for %s', (_name, overrides) => {
    expect(solveCard(solve(overrides), null).cube).toBeNull();
  });

  it('names the file after the day of the solve', () => {
    expect(solveCardFilename(solve())).toBe('rubix-single-2026-09-23.png');
  });
});
